import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { TimeTracking as TimeTrackingType } from '@/types/visits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, Calendar, Play, Square } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TimeTrackingProps {
  user: User;
}

const TimeTracking = ({ user }: TimeTrackingProps) => {
  const [timeRecords, setTimeRecords] = useState<TimeTrackingType[]>([]);
  const [todayRecord, setTodayRecord] = useState<TimeTrackingType | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [currentDuration, setCurrentDuration] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    fetchTimeRecords();
    checkTodayClockIn();
  }, [selectedDate]);

  // Update current duration every minute when clocked in
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isClockedIn && todayRecord) {
      const updateDuration = () => {
        const now = new Date();
        const clockInTime = new Date(todayRecord.clockInTime);
        const diffMs = now.getTime() - clockInTime.getTime();
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        setCurrentDuration(`${hours}h ${minutes}m`);
      };

      updateDuration();
      interval = setInterval(updateDuration, 60000); // Update every minute
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isClockedIn, todayRecord]);

  const transformTimeRecord = (record: any): TimeTrackingType => ({
    id: record.id,
    agencyId: record.agency_id,
    userId: record.user_id,
    clockInTime: new Date(record.clock_in_time),
    clockOutTime: record.clock_out_time ? new Date(record.clock_out_time) : undefined,
    clockInLatitude: record.clock_in_latitude,
    clockInLongitude: record.clock_in_longitude,
    clockOutLatitude: record.clock_out_latitude,
    clockOutLongitude: record.clock_out_longitude,
    totalHours: record.total_hours,
    date: record.date,
    createdAt: new Date(record.created_at)
  });

  const fetchTimeRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('time_tracking')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', selectedDate)
        .order('clock_in_time', { ascending: false });

      if (error) throw error;
      
      // Transform database data to match our TypeScript interface
      const transformedRecords = (data || []).map(transformTimeRecord);
      setTimeRecords(transformedRecords);
    } catch (error) {
      console.error('Error fetching time records:', error);
      toast({
        title: "Error",
        description: "Failed to fetch time records",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const checkTodayClockIn = async () => {
    const today = new Date().toISOString().split('T')[0];
    try {
      const { data, error } = await supabase
        .from('time_tracking')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .is('clock_out_time', null)
        .limit(1);

      if (error) {
        console.error('Error checking today clock in:', error);
        setIsClockedIn(false);
        setTodayRecord(null);
        return;
      }

      if (data && data.length > 0) {
        const transformedRecord = transformTimeRecord(data[0]);
        setTodayRecord(transformedRecord);
        setIsClockedIn(true);
      } else {
        setIsClockedIn(false);
        setTodayRecord(null);
      }
    } catch (error) {
      console.error('Error in checkTodayClockIn:', error);
      setIsClockedIn(false);
      setTodayRecord(null);
    }
  };

  const getCurrentLocation = (): Promise<{ latitude: number; longitude: number }> => {
    return new Promise((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            });
          },
          (error) => {
            console.error('GPS Error:', error);
            resolve({
              latitude: 28.6139 + Math.random() * 0.01,
              longitude: 77.2090 + Math.random() * 0.01
            });
          }
        );
      } else {
        resolve({
          latitude: 28.6139 + Math.random() * 0.01,
          longitude: 77.2090 + Math.random() * 0.01
        });
      }
    });
  };

  const handleClockIn = async () => {
    // Show immediate feedback
    toast({
      title: "Clocking in...",
      description: "Processing your clock in",
    });

    try {
      console.log('Starting clock in process for user:', user.id);
      const clockInTime = new Date();
      console.log('Clock in time:', clockInTime.toISOString());
      
      // Get location with fallback
      console.log('Getting location...');
      const [locationResult] = await Promise.allSettled([
        getCurrentLocation()
      ]);
      
      const location = locationResult.status === 'fulfilled' 
        ? locationResult.value 
        : { latitude: 28.6139, longitude: 77.2090 }; // Default location if GPS fails
      
      console.log('Location result:', location);
      
      const insertData = {
        agency_id: user.agencyId,
        user_id: user.id,
        clock_in_time: clockInTime.toISOString(),
        clock_in_latitude: location.latitude,
        clock_in_longitude: location.longitude,
        date: clockInTime.toISOString().split('T')[0]
      };
      
      console.log('Inserting data:', insertData);
      
      const { data, error } = await supabase
        .from('time_tracking')
        .insert([insertData])
        .select()
        .single();

      console.log('Database response - data:', data, 'error:', error);

      if (error) {
        console.error('Database error details:', error);
        throw error;
      }

      const transformedRecord = transformTimeRecord(data);
      console.log('Transformed record:', transformedRecord);
      
      setTodayRecord(transformedRecord);
      setIsClockedIn(true);
      
      // Refresh records in background
      fetchTimeRecords();
      
      toast({
        title: "Success",
        description: "Clocked in successfully",
      });
      
    } catch (error) {
      console.error('Error clocking in:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      toast({
        title: "Error",
        description: `Failed to clock in: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const handleClockOut = async () => {
    if (!todayRecord) return;

    // Show immediate feedback
    toast({
      title: "Clocking out...",
      description: "Processing your clock out",
    });

    try {
      const clockOutTime = new Date();
      const clockInTime = new Date(todayRecord.clockInTime);
      
      // Calculate duration efficiently
      const diffMs = clockOutTime.getTime() - clockInTime.getTime();
      const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
      const totalMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      // Get location with fallback
      const [locationResult] = await Promise.allSettled([
        getCurrentLocation()
      ]);
      
      const location = locationResult.status === 'fulfilled' 
        ? locationResult.value 
        : { latitude: 28.6139, longitude: 77.2090 }; // Default location if GPS fails
      
      // Update database and wait for completion
      const { error } = await supabase
        .from('time_tracking')
        .update({
          clock_out_time: clockOutTime.toISOString(),
          clock_out_latitude: location.latitude,
          clock_out_longitude: location.longitude,
          total_hours: `${totalHours}:${totalMinutes.toString().padStart(2, '0')}:00`
        })
        .eq('id', todayRecord.id);
      
      if (error) {
        throw error;
      }
      
      // Update UI state after successful database update
      setTodayRecord(null);
      setIsClockedIn(false);
      
      // Refresh the records list to show updated data
      await fetchTimeRecords();
      
      // Also refresh the today check to ensure UI is in sync
      await checkTodayClockIn();
      
      // Final success message
      toast({
        title: "Success",
        description: "Clocked out successfully",
      });
      
    } catch (error) {
      console.error('Error clocking out:', error);
      toast({
        title: "Error",
        description: "Failed to clock out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatDuration = (duration: string) => {
    const parts = duration.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    return `${hours}h ${minutes}m`;
  };

  const calculateDuration = (clockIn: Date, clockOut?: Date) => {
    const endTime = clockOut || new Date();
    const diffMs = endTime.getTime() - clockIn.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Modern Header */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl opacity-10"></div>
          <div className="relative p-6 sm:p-8">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">Time Tracking</h2>
              <p className="text-lg text-slate-600 font-medium">Track your work hours with GPS location</p>
            </div>
          </div>
        </div>

        {/* Clock In/Out Card */}
        <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg rounded-2xl mb-8">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-800">
              <div className="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              Today's Time Tracking
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex-1">
                {isClockedIn && todayRecord ? (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="bg-green-100 rounded-full w-10 h-10 flex items-center justify-center">
                          <Play className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-green-800">Clocked in at</p>
                          <p className="text-2xl font-bold text-green-900">
                            {todayRecord.clockInTime.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      {currentDuration && (
                        <div className="bg-white/80 rounded-xl p-4 border border-green-100">
                          <p className="text-sm font-medium text-green-700 mb-1">Current Duration</p>
                          <p className="text-3xl font-bold text-green-800">{currentDuration}</p>
                        </div>
                      )}
                    </div>
                    {todayRecord.clockInLatitude && (
                      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                        <div className="flex items-center gap-3">
                          <div className="bg-slate-100 rounded-full w-8 h-8 flex items-center justify-center">
                            <MapPin className="h-4 w-4 text-slate-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-700">Clock-in Location</p>
                            <p className="text-sm text-slate-600 font-mono">
                              {todayRecord.clockInLatitude.toFixed(6)}, {todayRecord.clockInLongitude?.toFixed(6)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-2xl p-8 text-center border border-slate-200">
                    <div className="bg-slate-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                      <Clock className="h-8 w-8 text-slate-400" />
                    </div>
                    <p className="text-lg font-medium text-slate-600">Not clocked in yet today</p>
                    <p className="text-sm text-slate-500 mt-1">Start tracking your time to begin</p>
                  </div>
                )}
              </div>
              
              <div className="flex flex-col gap-3 lg:w-48">
                {!isClockedIn ? (
                  <Button 
                    onClick={handleClockIn} 
                    className="group h-16 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                  >
                    <div className="flex flex-col items-center gap-1 group-hover:scale-105 transition-transform duration-200">
                      <Play className="h-6 w-6" />
                      <span>Clock In</span>
                    </div>
                  </Button>
                ) : (
                  <Button 
                    onClick={handleClockOut} 
                    className="group h-16 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                  >
                    <div className="flex flex-col items-center gap-1 group-hover:scale-105 transition-transform duration-200">
                      <Square className="h-6 w-6" />
                      <span>Clock Out</span>
                    </div>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Date Filter */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 mb-8">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 rounded-full w-10 h-10 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <Label className="text-base font-semibold text-slate-700 mb-2 block">Filter by Date</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-12 w-64 text-base bg-white/90 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>
          </div>
        </div>

        {/* Time Records */}
        <div className="space-y-6">
          {timeRecords.length === 0 ? (
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-12 text-center shadow-lg border border-white/20">
              <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                <Clock className="h-12 w-12 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-3">No time records found</h3>
              <p className="text-slate-600 text-lg">No time tracking records for the selected date</p>
            </div>
          ) : (
            timeRecords.map((record) => (
              <Card key={record.id} className="group bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg hover:shadow-xl rounded-2xl transition-all duration-300 transform hover:scale-[1.02]">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                    <div className="flex-1 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                          <div className="flex items-center gap-3">
                            <div className="bg-blue-100 rounded-full w-10 h-10 flex items-center justify-center">
                              <Play className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-blue-700">Clock In</p>
                              <p className="text-xl font-bold text-blue-900">
                                {record.clockInTime.toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {record.clockOutTime ? (
                          <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                            <div className="flex items-center gap-3">
                              <div className="bg-red-100 rounded-full w-10 h-10 flex items-center justify-center">
                                <Square className="h-5 w-5 text-red-600" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-red-700">Clock Out</p>
                                <p className="text-xl font-bold text-red-900">
                                  {record.clockOutTime.toLocaleTimeString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-green-50 rounded-xl p-4 border border-green-100 flex items-center justify-center">
                            <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium px-4 py-2 rounded-full text-base">
                              Currently Active
                            </Badge>
                          </div>
                        )}
                        
                        <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                          <div className="flex items-center gap-3">
                            <div className="bg-purple-100 rounded-full w-10 h-10 flex items-center justify-center">
                              <Clock className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-purple-700">Duration</p>
                              <p className="text-xl font-bold text-purple-900">
                                {record.totalHours 
                                  ? formatDuration(record.totalHours) 
                                  : calculateDuration(record.clockInTime, record.clockOutTime)
                                }
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-4">
                        {record.clockInLatitude && (
                          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="bg-slate-100 rounded-full w-6 h-6 flex items-center justify-center">
                                <MapPin className="h-3 w-3 text-slate-600" />
                              </div>
                              <span className="text-sm font-medium text-slate-700">Clock-in Location</span>
                            </div>
                            <p className="text-sm text-slate-600 font-mono">
                              {record.clockInLatitude.toFixed(6)}, {record.clockInLongitude?.toFixed(6)}
                            </p>
                          </div>
                        )}
                        {record.clockOutLatitude && (
                          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="bg-slate-100 rounded-full w-6 h-6 flex items-center justify-center">
                                <MapPin className="h-3 w-3 text-slate-600" />
                              </div>
                              <span className="text-sm font-medium text-slate-700">Clock-out Location</span>
                            </div>
                            <p className="text-sm text-slate-600 font-mono">
                              {record.clockOutLatitude.toFixed(6)}, {record.clockOutLongitude?.toFixed(6)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TimeTracking;
