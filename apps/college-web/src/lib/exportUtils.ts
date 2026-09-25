import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Extend jsPDF interface to recognize autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

/**
 * Exports data to an Excel (.xlsx) spreadsheet
 */
export function exportToExcel(data: Record<string, any>[], filename: string, sheetName: string = 'Sheet1') {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

/**
 * Exports data to a formatted professional academic PDF report
 */
export function exportToPdf(options: {
  title: string;
  subtitle?: string;
  filename: string;
  columns: { header: string; dataKey: string }[];
  data: Record<string, any>[];
  institutionName?: string;
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  const instName = options.institutionName || 'Apex Institute of Technology & Science';

  // Header banner
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 27, 75); // navy #1e1b4b
  doc.text(instName, 40, 40);

  doc.setFontSize(12);
  doc.setTextColor(79, 70, 229); // indigo
  doc.text(options.title, 40, 60);

  if (options.subtitle) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(options.subtitle, 40, 75);
  }

  const generatedDate = new Date().toLocaleString();
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated: ${generatedDate} | CampusAttend OS ERP`, 40, 90);

  // Table
  doc.autoTable({
    startY: 105,
    columns: options.columns,
    body: options.data,
    theme: 'striped',
    headStyles: {
      fillColor: [49, 46, 129], // #312e81
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 40, right: 40 },
  });

  doc.save(`${options.filename}.pdf`);
}
