import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 Starting external bot invoices sync from tnduapjjyqhppclgnqsb...')

    // Current Supabase instance
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // First, ensure RLS is disabled on the target table (using service role)
    console.log('🔧 Ensuring table is accessible...')
    
    // Try to create a test record to check if RLS is an issue
    const testRecord = {
      id: 999999999,
      name: 'TEST_RECORD',
      partner_name: 'TEST',
      amount_total: 0,
      state: 'test',
      sync_timestamp: new Date().toISOString(),
      agency_match: null
    }
    
    const { error: testError } = await supabase
      .from('external_bot_project_invoices')
      .insert(testRecord)
    
    if (testError) {
      console.warn('⚠️ Test insert failed - RLS may be enabled:', testError.message)
      // If test fails, we'll still continue - the service role should bypass RLS
    } else {
      console.log('✅ Test insert successful - cleaning up...')
      // Clean up test record
      await supabase
        .from('external_bot_project_invoices')
        .delete()
        .eq('id', 999999999)
    }

    // External Supabase instance (tnduapjjyqhppclgnqsb)
    const externalSupabaseUrl = 'https://tnduapjjyqhppclgnqsb.supabase.co'
    const externalSupabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuZHVhcGpqeXFocHBjbGducXNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyMTQ4ODcsImV4cCI6MjA2NDc5MDg4N30.4r-K4iFN0U3V9wZoWPLotFEvNVznVvxlAFLuFOvizDw'
    const externalSupabase = createClient(externalSupabaseUrl, externalSupabaseKey)

    // Fetch invoices from external database
    console.log('📊 Fetching invoices from external database...')
    const { data: externalInvoices, error: fetchError } = await externalSupabase
      .from('invoices')
      .select('*')
      .order('id', { ascending: false })

    if (fetchError) {
      console.error('❌ Error fetching external invoices:', fetchError)
      throw new Error(`Failed to fetch external invoices: ${fetchError.message}`)
    }

    console.log(`✅ Fetched ${externalInvoices?.length || 0} invoices from external database`)

    if (!externalInvoices || externalInvoices.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No invoices found in external database',
        synced_count: 0,
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Clear existing data
    console.log('🗑️ Clearing existing external bot invoices...')
    const { error: deleteError } = await supabase
      .from('external_bot_project_invoices')
      .delete()
      .neq('id', -999999) // Delete all

    if (deleteError) {
      console.warn('⚠️ Warning clearing existing data:', deleteError.message)
    }

    // Transform and prepare data for insertion
    console.log('🔄 Transforming invoice data...')
    const transformedInvoices = externalInvoices.map((invoice: any, index: number) => {
      // Generate a numeric ID from the string ID or use index-based fallback
      let numericId: number
      if (typeof invoice.id === 'number') {
        numericId = invoice.id
      } else if (typeof invoice.id === 'string') {
        // Extract numbers from string ID like "INV/2025/00614" -> 2025614
        const numbers = invoice.id.replace(/\D/g, '')
        numericId = numbers ? parseInt(numbers) : Date.now() + index
      } else {
        numericId = Date.now() + index
      }
      
      return {
        id: numericId,
        name: invoice.name || invoice.id?.toString() || `INV-${numericId}`,
      partner_name: invoice.partner_name || 'Unknown Customer',
      date_order: invoice.date_order || null,
      amount_total: invoice.amount_total || 0,
      state: invoice.state || 'unknown',
      order_lines: invoice.order_lines || null,
      company_id: invoice.company_id || null,
      user_id: invoice.user_id || null,
      team_id: invoice.team_id || null,
      currency_id: invoice.currency_id || 'LKR',
      payment_state: invoice.payment_state || null,
      date_invoice: invoice.date_invoice || null,
      invoice_origin: invoice.invoice_origin || null,
      reference: invoice.reference || null,
      move_type: invoice.move_type || null,
      journal_id: invoice.journal_id || null,
      fiscal_position_id: invoice.fiscal_position_id || null,
      invoice_payment_term_id: invoice.invoice_payment_term_id || null,
      auto_post: invoice.auto_post || false,
      to_check: invoice.to_check || false,
      sync_timestamp: new Date().toISOString(),
      agency_match: null // Can be populated later with matching logic
    }
    })

    // Insert data in batches to avoid timeouts
    const batchSize = 1000
    let totalInserted = 0

    for (let i = 0; i < transformedInvoices.length; i += batchSize) {
      const batch = transformedInvoices.slice(i, i + batchSize)
      const batchNum = Math.floor(i / batchSize) + 1
      const totalBatches = Math.ceil(transformedInvoices.length / batchSize)
      
      console.log(`📥 Inserting batch ${batchNum}/${totalBatches} (${batch.length} records)`)
      
      const { error: insertError } = await supabase
        .from('external_bot_project_invoices')
        .insert(batch)

      if (insertError) {
        console.error(`❌ Error inserting batch ${batchNum}:`, insertError)
        throw new Error(`Failed to insert batch ${batchNum}: ${insertError.message}`)
      }

      totalInserted += batch.length
    }

    // Get final statistics
    const { count } = await supabase
      .from('external_bot_project_invoices')
      .select('*', { count: 'exact', head: true })

    console.log(`🎉 Successfully synced ${totalInserted} invoices (${count} total in table)`)

    return new Response(JSON.stringify({
      success: true,
      message: 'External bot invoices synced successfully',
      synced_count: totalInserted,
      total_in_table: count,
      external_source: 'tnduapjjyqhppclgnqsb.supabase.co',
      sync_timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('💥 Error in sync-external-bot-invoices:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})