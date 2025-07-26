import { Camera, CameraResultType, CameraSource, CameraPermissionStatus } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

export class CameraService {
  private static async checkPermissions(): Promise<boolean> {
    if (Capacitor.getPlatform() === 'web') {
      return true;
    }

    const permissionStatus = await Camera.checkPermissions();
    
    if (permissionStatus.camera === 'granted') {
      return true;
    }

    if (permissionStatus.camera === 'prompt') {
      const requestResult = await Camera.requestPermissions();
      return requestResult.camera === 'granted';
    }

    return false;
  }

  static async takePicture(): Promise<string | null> {
    try {
      const hasPermission = await this.checkPermissions();
      
      if (!hasPermission) {
        throw new Error('Camera permission not granted');
      }

      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera
      });

      return image.webPath || null;
    } catch (error) {
      console.error('Error taking picture:', error);
      throw error;
    }
  }

  static async pickFromGallery(): Promise<string | null> {
    try {
      const hasPermission = await this.checkPermissions();
      
      if (!hasPermission) {
        throw new Error('Camera permission not granted');
      }

      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.Uri,
        source: CameraSource.Photos
      });

      return image.webPath || null;
    } catch (error) {
      console.error('Error picking from gallery:', error);
      throw error;
    }
  }
} 