import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LocationService } from '@/services/location.service';
import { useToast } from '@/hooks/use-toast';

// A request older than this is stale: the superuser's screen has already
// given up waiting and fallen back to the last known location.
const MAX_REQUEST_AGE_MS = 2 * 60 * 1000;

interface LocationRequestResponderProps {
  userId: string;
}

interface PendingRequest {
  id: string;
  created_at: string;
  status: string;
}

// Answers on-demand location checks from head office. It reads GPS once per
// request and nothing in between — there is no continuous tracking. It only
// works while the app is open, and the agent is told each time it happens.
const LocationRequestResponder = ({ userId }: LocationRequestResponderProps) => {
  const { toast } = useToast();
  const handledRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const answer = async (request: PendingRequest) => {
      if (request.status !== 'pending') return;
      if (handledRef.current.has(request.id)) return;
      if (Date.now() - new Date(request.created_at).getTime() > MAX_REQUEST_AGE_MS) return;
      handledRef.current.add(request.id);

      try {
        const location = await LocationService.getCurrentPosition();
        await supabase
          .from('location_requests')
          .update({
            status: 'fulfilled',
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
            responded_at: new Date().toISOString(),
          })
          .eq('id', request.id);

        toast({
          title: 'Location shared',
          description: 'Your current location was shared with head office.',
        });
      } catch (error) {
        // Tell the requester why, so they can fall back to the last known location.
        await supabase
          .from('location_requests')
          .update({
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
            responded_at: new Date().toISOString(),
          })
          .eq('id', request.id);
      }
    };

    // Pick up a request made just before the app was opened.
    (async () => {
      const since = new Date(Date.now() - MAX_REQUEST_AGE_MS).toISOString();
      const { data } = await supabase
        .from('location_requests')
        .select('id, created_at, status')
        .eq('target_user_id', userId)
        .eq('status', 'pending')
        .gte('created_at', since);
      if (!cancelled) (data || []).forEach((request) => void answer(request));
    })();

    const channel = supabase
      .channel(`location-requests-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'location_requests',
          filter: `target_user_id=eq.${userId}`,
        },
        (payload) => void answer(payload.new as PendingRequest)
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId, toast]);

  return null;
};

export default LocationRequestResponder;
