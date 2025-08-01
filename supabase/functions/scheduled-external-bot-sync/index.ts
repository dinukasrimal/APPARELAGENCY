import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🕒 Starting scheduled external bot invoices sync...')

    // Current Supabase instance
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Call the existing sync function
    const syncResponse = await fetch(`${supabaseUrl}/functions/v1/sync-external-bot-invoices`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (!syncResponse.ok) {
      const errorText = await syncResponse.text()
      throw new Error(`Sync function failed: ${syncResponse.status} ${syncResponse.statusText} - ${errorText}`)
    }

    const result = await syncResponse.json()
    
    // Log the sync result to a table for monitoring
    try {
      await supabase
        .from('external_bot_sync_log')
        .insert({
          sync_timestamp: new Date().toISOString(),
          status: result.success ? 'success' : 'error',
          synced_count: result.synced_count || 0,
          message: result.message,
          details: result
        })
    } catch (logError) {
      console.warn('⚠️ Failed to log sync result:', logError)
    }

    console.log(`✅ Scheduled sync completed: ${result.message}`)

    return new Response(JSON.stringify({
      success: true,
      message: 'Scheduled sync completed successfully',
      sync_result: result,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('💥 Error in scheduled sync:', error)
    
    // Try to log the error
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      
      await supabase
        .from('external_bot_sync_log')
        .insert({
          sync_timestamp: new Date().toISOString(),
          status: 'error',
          synced_count: 0,
          message: error.message,
          details: { error: error.message }
        })
    } catch (logError) {
      console.warn('⚠️ Failed to log error:', logError)
    }

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