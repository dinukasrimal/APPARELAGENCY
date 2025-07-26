
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Attempting to retrieve Google Maps API key...')
    
    // Try to get the API key from environment variables
    const apiKey = Deno.env.get('VITE_GOOGLE_MAPS_API_KEY')
    
    console.log('API key found:', apiKey ? 'Yes' : 'No')
    
    if (!apiKey) {
      console.error('Google Maps API key not found in environment variables')
      return new Response(
        JSON.stringify({ error: 'Google Maps API key not configured' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Returning API key successfully')
    return new Response(
      JSON.stringify({ apiKey }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    console.error('Error in get-google-maps-key function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
