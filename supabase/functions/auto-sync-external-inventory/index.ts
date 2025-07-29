import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get request body
    const { type, table, record, old_record } = await req.json()
    
    console.log('🔄 Auto-sync triggered:', { type, table, record: record?.id })

    // Only process INSERT operations on external_invoices table
    if (type !== 'INSERT' || table !== 'external_invoices') {
      return new Response(
        JSON.stringify({ message: 'No action needed', type, table }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the partner name from the new invoice
    const partnerName = record.partner_name
    if (!partnerName) {
      console.warn('⚠️ No partner_name found in external invoice:', record.id)
      return new Response(
        JSON.stringify({ error: 'No partner_name found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find matching user profile by name
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, agency_id, name')
      .ilike('name', partnerName)
      .single()

    if (profileError || !profile) {
      console.warn('⚠️ No matching profile found for partner:', partnerName)
      return new Response(
        JSON.stringify({ error: 'No matching profile found', partner_name: partnerName }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('👤 Found matching profile:', profile.name, 'Agency:', profile.agency_id)

    // Create user object for the external inventory service
    const user = {
      id: profile.id,
      agencyId: profile.agency_id || '',
      role: 'agent' as const,
      name: profile.name
    }

    // Check if this invoice has already been processed
    const { data: existingTransactions } = await supabase
      .from('inventory_transactions')
      .select('id')
      .eq('transaction_type', 'external_invoice')
      .eq('external_invoice_id', record.id)
      .limit(1)

    if (existingTransactions && existingTransactions.length > 0) {
      console.log('📦 Invoice already processed:', record.id)
      return new Response(
        JSON.stringify({ message: 'Invoice already processed', invoice_id: record.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse order_lines from the new invoice
    let orderLines = record.order_lines
    if (typeof orderLines === 'string') {
      orderLines = JSON.parse(orderLines)
    }

    if (!Array.isArray(orderLines) || orderLines.length === 0) {
      console.warn('⚠️ No valid order lines found in invoice:', record.id)
      return new Response(
        JSON.stringify({ error: 'No valid order lines found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📦 Processing ${orderLines.length} order lines for invoice:`, record.id)

    let processedItems = 0
    let matchedProducts = 0
    let unmatchedProducts = 0
    const errors: string[] = []

    // Process each line item
    for (const line of orderLines) {
      try {
        if (!line.product_category || !line.qty_delivered || !line.price_unit) {
          console.warn('📦 Incomplete line item data:', line)
          continue
        }

        // Simple product matching logic (simplified version of the service)
        const productName = line.product_name || line.product_category
        const { data: matchedProduct } = await supabase
          .from('products')
          .select('id, name, colors, sizes, category')
          .ilike('name', `%${productName}%`)
          .limit(1)
          .single()

        if (matchedProduct) {
          // Create inventory transaction for matched product
          const { error: transactionError } = await supabase
            .from('inventory_transactions')
            .insert({
              product_id: matchedProduct.id,
              product_name: matchedProduct.name,
              color: matchedProduct.colors?.[0] || 'Default',
              size: matchedProduct.sizes?.[0] || 'Default',
              transaction_type: 'external_invoice',
              quantity: Number(line.qty_delivered), // Positive for stock IN
              reference_id: record.id,
              reference_name: `External Invoice ${record.id}`,
              user_id: user.id,
              agency_id: user.agencyId,
              external_product_name: productName,
              external_product_category: line.product_category,
              external_invoice_id: record.id,
              notes: 'Auto-imported via webhook trigger'
            })

          if (transactionError) {
            console.error('❌ Error creating inventory transaction:', transactionError)
            errors.push(`Error creating transaction for ${productName}: ${transactionError.message}`)
          } else {
            processedItems++
            matchedProducts++
            console.log(`📦 ✅ Created inventory transaction for ${matchedProduct.name} (${line.qty_delivered} units)`)
          }
        } else {
          unmatchedProducts++
          console.log(`📦 ❌ Could not match product: ${productName} (category: ${line.product_category})`)
        }
      } catch (lineError) {
        console.error('❌ Error processing line item:', lineError)
        errors.push(`Error processing line item: ${lineError instanceof Error ? lineError.message : 'Unknown error'}`)
      }
    }

    const result = {
      invoice_id: record.id,
      partner_name: partnerName,
      processed_items: processedItems,
      matched_products: matchedProducts,
      unmatched_products: unmatchedProducts,
      errors: errors.length > 0 ? errors : undefined,
      message: 'External invoice automatically processed for inventory'
    }

    console.log('📦 ✅ Auto-sync completed:', result)

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error in auto-sync function:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})