import { appendToSheet } from './googleSheets';
appendToSheet('Vehicles!A:D', [['test']]).then(() => console.log('done')).catch(console.error);
