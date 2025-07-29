import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// External database connection details
const externalSupabaseUrl = Deno.env.get('EXTERNAL_SUPABASE_URL')!
const externalServiceKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const externalSupabase = createClient(externalSupabaseUrl, externalServiceKey)
    
    console.log('🔄 Starting scheduled external invoice sync...')

    // Get the last sync timestamp from settings or default to 24 hours ago
    const { data: lastSyncSetting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'last_external_sync')
      .single()

    const lastSyncTime = lastSyncSetting?.value 
      ? new Date(lastSyncSetting.value)
      : new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago

    console.log('📅 Last sync time:', lastSyncTime.toISOString())

    // Get new external invoices since last sync
    const { data: newInvoices, error: invoiceError } = await externalSupabase
      .from('invoices')
      .select('*')
      .gte('create_date', lastSyncTime.toISOString())
      .order('create_date', { ascending: true })

    if (invoiceError) {
      console.error('❌ Error fetching new external invoices:', invoiceError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch external invoices', details: invoiceError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!newInvoices || newInvoices.length === 0) {
      console.log('✅ No new external invoices found')
      return new Response(
        JSON.stringify({ message: 'No new invoices to process', last_sync: lastSyncTime }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📦 Found ${newInvoices.length} new external invoices to process`)

    let totalProcessed = 0
    let totalMatched = 0
    let totalUnmatched = 0
    const errors: string[] = []

    // Process each new invoice
    for (const invoice of newInvoices) {
      try {
        // Check if this invoice has already been processed
        const { data: existingTransactions } = await supabase
          .from('inventory_transactions')
          .select('id')
          .eq('transaction_type', 'external_invoice')
          .eq('external_invoice_id', invoice.id)
          .limit(1)

        if (existingTransactions && existingTransactions.length > 0) {
          console.log('📦 Skipping already processed invoice:', invoice.id)
          continue
        }

        // Find matching user profile by partner name
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, agency_id, name')
          .ilike('name', invoice.partner_name)
          .single()

        if (profileError || !profile) {
          console.warn('⚠️ No matching profile found for partner:', invoice.partner_name)
          errors.push(`No matching profile found for partner: ${invoice.partner_name}`)
          continue
        }

        // Parse order_lines
        let orderLines = invoice.order_lines
        if (typeof orderLines === 'string') {
          orderLines = JSON.parse(orderLines)
        }

        if (!Array.isArray(orderLines) || orderLines.length === 0) {
          console.warn('⚠️ No valid order lines found in invoice:', invoice.id)
          errors.push(`No valid order lines found in invoice: ${invoice.id}`)
          continue
        }

        // Process each line item
        for (const line of orderLines) {
          if (!line.product_category || !line.qty_delivered || line.qty_delivered <= 0) {
            continue
          }

          const productName = line.product_name || line.product_category

          // Try to match external product to internal catalog
          const { data: matchedProducts } = await supabase
            .from('products')
            .select('id, name, colors, sizes, category')
            .or(`name.ilike.%${productName}%,category.ilike.%${line.product_category}%`)
            .limit(5)

          let bestMatch = null
          let highestScore = 0

          // Simple scoring algorithm
          for (const product of matchedProducts || []) {
            let score = 0
            
            // Name matching
            if (product.name.toLowerCase().includes(productName.toLowerCase())) {
              score += 50
            }
            
            // Category matching
            if (product.category.toLowerCase().includes(line.product_category.toLowerCase())) {
              score += 30
            }

            if (score > highestScore && score >= 30) {
              highestScore = score
              bestMatch = product
            }
          }

          if (bestMatch) {
            // Create inventory transaction for matched product
            const { error: transactionError } = await supabase
              .from('inventory_transactions')
              .insert({
                product_id: bestMatch.id,
                product_name: bestMatch.name,
                color: bestMatch.colors?.[0] || 'Default',
                size: bestMatch.sizes?.[0] || 'Default',
                transaction_type: 'external_invoice',
                quantity: Number(line.qty_delivered),
                reference_id: invoice.id,
                reference_name: `External Invoice ${invoice.id}`,
                user_id: profile.id,
                agency_id: profile.agency_id,
                external_product_name: productName,
                external_product_category: line.product_category,
                external_invoice_id: invoice.id,
                notes: `Auto-imported via scheduled sync. Match score: ${highestScore}%`
              })

            if (transactionError) {
              console.error('❌ Error creating inventory transaction:', transactionError)
              errors.push(`Error creating transaction for ${productName}: ${transactionError.message}`)
            } else {
              totalProcessed++
              totalMatched++
              console.log(`📦 ✅ Created inventory transaction for ${bestMatch.name} (${line.qty_delivered} units)`)
            }
          } else {
            totalUnmatched++
            console.log(`📦 ❌ Could not match product: ${productName} (category: ${line.product_category})`)
          }
        }
      } catch (invoiceError) {
        console.error('❌ Error processing invoice:', invoice.id, invoiceError)
        errors.push(`Error processing invoice ${invoice.id}: ${invoiceError instanceof Error ? invoiceError.message : 'Unknown error'}`)
      }
    }

    // Update the last sync timestamp
    const currentTime = new Date().toISOString()
    await supabase.from('app_settings').upsert({
      key: 'last_external_sync',
      value: currentTime,
      updated_at: currentTime
    })

    const result = {
      message: 'Scheduled external invoice sync completed',
      invoices_found: newInvoices.length,
      transactions_created: totalProcessed,
      products_matched: totalMatched,
      products_unmatched: totalUnmatched,
      errors: errors.length > 0 ? errors : undefined,
      last_sync: lastSyncTime,
      current_sync: currentTime
    }

    console.log('✅ Scheduled sync completed:', result)

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error in scheduled sync function:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})