import { registerLicense } from '@syncfusion/ej2-base';

export const SYNCFUSION_SPREADSHEET_SERVICE_URL =
  'https://document.syncfusion.com/web-services/spreadsheet-editor/api/spreadsheet';

let licenseRegistered = false;

export function registerSyncfusionLicense(): void {
  if (licenseRegistered) return;

  const license = process.env.NEXT_PUBLIC_SYNCFUSION_LICENSE?.trim();
  if (license) {
    registerLicense(license);
    licenseRegistered = true;
  } else if (process.env.NODE_ENV === 'development') {
    console.warn(
      '[Syncfusion] NEXT_PUBLIC_SYNCFUSION_LICENSE is not set — spreadsheet may show a license banner.',
    );
  }
}
