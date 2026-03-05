import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

const getAuth = () => {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    console.warn('Google Sheets credentials are not fully configured.');
    return null;
  }

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: SCOPES,
  });
};

export const appendToSheet = async (range: string, values: any[][]) => {
  const auth = getAuth();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!auth || !spreadsheetId) {
    console.warn('Skipping Google Sheets update due to missing credentials or Sheet ID.');
    return;
  }

  const sheets = google.sheets({ version: 'v4', auth });

  try {
    // Extract sheet name from range (e.g., "Vehicles!A:D" -> "Vehicles")
    const sheetName = range.split('!')[0];
    
    // Check if sheet exists
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetExists = spreadsheet.data.sheets?.some(s => s.properties?.title === sheetName);

    // If sheet doesn't exist, create it
    if (!sheetExists) {
      console.log(`Sheet "${sheetName}" does not exist. Creating it...`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName,
                },
              },
            },
          ],
        },
      });
      console.log(`Successfully created sheet: ${sheetName}`);
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });
    console.log(`Successfully appended data to sheet: ${range}`);
  } catch (error) {
    console.error('Error appending to Google Sheets:', error);
  }
};
