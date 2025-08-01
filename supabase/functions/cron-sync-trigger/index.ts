import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🕒 Cron sync trigger received...')

    // Current Supabase instance
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if this is a scheduled trigger (vs manual)
    const { source = 'manual' } = await req.json().catch(() => ({ source: 'cron' }))

    // Log the trigger
    await supabase
      .from('external_bot_sync_log')
      .insert({
        sync_timestamp: new Date().toISOString(),
        status: 'cron_triggered',
        synced_count: 0,
        message: `Sync triggered from ${source}`,
        details: { source, timestamp: new Date().toISOString() }
      })

    // Call the main sync function
    const syncResponse = await fetch(`${supabaseUrl}/functions/v1/sync-external-bot-invoices`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      }
    })

    let result
    if (syncResponse.ok) {
      result = await syncResponse.json()
      console.log(`✅ Cron sync completed: ${result.message}`)
    } else {
      const errorText = await syncResponse.text()
      result = {
        success: false,
        error: `Sync function failed: ${syncResponse.status} ${syncResponse.statusText} - ${errorText}`
      }
      console.error(`❌ Cron sync failed: ${result.error}`)
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Cron sync trigger processed',
      sync_result: result,
      triggered_by: source,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('💥 Error in cron sync trigger:', error)
    
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