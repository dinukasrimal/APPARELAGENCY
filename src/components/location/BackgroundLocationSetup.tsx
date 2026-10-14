import { useEffect, useState } from 'react';
import { MapPin, BatteryCharging, Settings } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BackgroundLocationService, BackgroundLocationStatus } from '@/services/background-location.service';

// Asking again on every launch would be nagging; asking once and never again
// would leave it switched off forever. A week is the compromise.
const SNOOZE_KEY = 'bg-location-setup-snoozed-until';
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

interface BackgroundLocationSetupProps {
  userId: string;
}

/**
 * Registers the phone for location checks, and — the first time something is
 * missing — explains to the agent what head office can see and asks them to
 * grant it. The explanation is the point: this is the disclosure, and it is
 * shown before the permission is of any use, not buried in a policy.
 */
const BackgroundLocationSetup = ({ userId }: BackgroundLocationSetupProps) => {
  const [status, setStatus] = useState<BackgroundLocationStatus | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = async () => {
    const current = await BackgroundLocationService.getStatus();
    setStatus(current);
    return current;
  };

  useEffect(() => {
    if (!BackgroundLocationService.isSupported()) return;

    (async () => {
      await BackgroundLocationService.registerDevice(userId);
      const current = await refresh();
      if (!current) return;

      const ready = current.fineLocation && current.backgroundLocation && current.batteryUnrestricted;
      const snoozedUntil = Number(localStorage.getItem(SNOOZE_KEY) || 0);
      if (!ready && Date.now() > snoozedUntil) setOpen(true);
    })();
  }, [userId]);

  const snooze = () => {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    setOpen(false);
  };

  if (!status) return null;

  const steps = [
    {
      done: status.fineLocation && status.backgroundLocation,
      icon: MapPin,
      title: 'Location: "Allow all the time"',
      body: 'Android only offers this in Settings, not in a pop-up. Open Permissions → Location and choose "Allow all the time".',
      action: { label: 'Open settings', run: () => BackgroundLocationService.openAppSettings() },
    },
    {
      done: status.batteryUnrestricted,
      icon: BatteryCharging,
      title: 'Battery: unrestricted',
      body: 'Otherwise the phone sleeps the app and the request never arrives. On Xiaomi, Oppo, Vivo and Realme also switch on Autostart.',
      action: { label: 'Allow', run: () => BackgroundLocationService.requestUnrestrictedBattery() },
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : snooze())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Let head office check your location</DialogTitle>
          <DialogDescription>
            Head office can ask where you are during working hours, including when the app is closed. Your phone
            answers with a single GPS reading at that moment — nothing is recorded in between, and your location is
            never followed continuously. For this to work the phone needs two settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {steps.map((step) => (
            <div key={step.title} className="flex items-start gap-3 rounded-lg border p-3">
              <step.icon className={`mt-0.5 h-5 w-5 shrink-0 ${step.done ? 'text-green-600' : 'text-amber-600'}`} />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {step.title} {step.done && <span className="text-green-600">· done</span>}
                </p>
                {!step.done && <p className="mt-1 text-xs text-muted-foreground">{step.body}</p>}
              </div>
              {!step.done && (
                <Button size="sm" variant="outline" onClick={() => void step.action.run()}>
                  {step.action.label}
                </Button>
              )}
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={snooze}>
            Not now
          </Button>
          <Button size="sm" onClick={() => void refresh()}>
            <Settings className="mr-2 h-4 w-4" />
            I've done it — check again
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BackgroundLocationSetup;
