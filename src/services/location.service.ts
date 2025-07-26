import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export class LocationService {
  private static async checkPermissions(): Promise<boolean> {
    if (Capacitor.getPlatform() === 'web') {
      return true;
    }

    const permissionStatus = await Geolocation.checkPermissions();
    
    if (permissionStatus.location === 'granted') {
      return true;
    }

    if (permissionStatus.location === 'prompt') {
      const requestResult = await Geolocation.requestPermissions();
      return requestResult.location === 'granted';
    }

    return false;
  }

  static async getCurrentPosition(): Promise<LocationData> {
    try {
      const hasPermission = await this.checkPermissions();
      
      if (!hasPermission) {
        throw new Error('Location permission not granted');
      }

      const coordinates = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });

      return {
        latitude: coordinates.coords.latitude,
        longitude: coordinates.coords.longitude,
        accuracy: coordinates.coords.accuracy,
        timestamp: coordinates.timestamp
      };
    } catch (error) {
      console.error('Error getting location:', error);
      throw error;
    }
  }

  static async watchPosition(
    callback: (location: LocationData) => void,
    errorCallback?: (error: any) => void
  ): Promise<string> {
    try {
      const hasPermission = await this.checkPermissions();
      
      if (!hasPermission) {
        throw new Error('Location permission not granted');
      }

      const watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        },
        (coordinates) => {
          callback({
            latitude: coordinates.coords.latitude,
            longitude: coordinates.coords.longitude,
            accuracy: coordinates.coords.accuracy,
            timestamp: coordinates.timestamp
          });
        }
      );

      return watchId;
    } catch (error) {
      console.error('Error watching location:', error);
      if (errorCallback) {
        errorCallback(error);
      }
      throw error;
    }
  }

  static async clearWatch(watchId: string): Promise<void> {
    try {
      await Geolocation.clearWatch({ id: watchId });
    } catch (error) {
      console.error('Error clearing location watch:', error);
      throw error;
    }
  }
} 