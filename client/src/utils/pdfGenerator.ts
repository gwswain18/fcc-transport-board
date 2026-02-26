import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface PdfOptions {
  title: string;
  dateRange: string;
  reportType: 'global' | 'individual';
  transporterName?: string;
}

export async function generatePdf(
  container: HTMLElement,
  options: PdfOptions,
  onProgress?: (msg: string) => void
): Promise<void> {
  const { dateRange, reportType, transporterName } = options;

  onProgress?.('Preparing PDF layout...');

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let currentY = margin;
  let pageNum = 1;
  const totalPagesPlaceholder = '{total}';

  const addPageFooter = (page: number) => {
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `FCC Transport Report — Page ${page} of ${totalPagesPlaceholder}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  };

  // --- Header ---
  onProgress?.('Adding report header...');

  // Try to load logo
  try {
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    await new Promise<void>((resolve) => {
      logoImg.onload = () => resolve();
      logoImg.onerror = () => resolve();
      logoImg.src = '/logo.png';
    });
    if (logoImg.naturalWidth > 0) {
      const logoHeight = 12;
      const logoWidth = (logoImg.naturalWidth / logoImg.naturalHeight) * logoHeight;
      pdf.addImage(logoImg, 'PNG', margin, currentY, logoWidth, logoHeight);
      currentY += logoHeight + 4;
    }
  } catch {
    // Skip logo if not available
  }

  // Title
  pdf.setFontSize(20);
  pdf.setTextColor(0, 41, 82); // Prussian blue
  if (reportType === 'individual' && transporterName) {
    pdf.text(`Transporter Report: ${transporterName}`, margin, currentY + 6);
  } else {
    pdf.text('FCC Transport Report', margin, currentY + 6);
  }
  currentY += 12;

  // Date range & generated timestamp
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  pdf.text(`Date Range: ${dateRange}`, margin, currentY);
  currentY += 5;
  const now = new Date();
  const generated = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }) + ' at ' + now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  pdf.text(`Generated: ${generated}`, margin, currentY);
  currentY += 4;

  // Divider
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 6;

  addPageFooter(pageNum);

  // --- Capture sections ---
  const sections = container.querySelectorAll<HTMLElement>('[data-pdf-section]');

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const sectionName = section.getAttribute('data-pdf-section') || `Section ${i + 1}`;
    onProgress?.(`Rendering ${sectionName}...`);

    const canvas = await html2canvas(section, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height / canvas.width) * imgWidth;

    // Check if we need a new page
    if (currentY + imgHeight > pageHeight - 20) {
      pdf.addPage();
      pageNum++;
      currentY = margin;
      addPageFooter(pageNum);
    }

    pdf.addImage(imgData, 'PNG', margin, currentY, imgWidth, imgHeight);
    currentY += imgHeight + 6;
  }

  // Replace total page placeholders
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    // Overwrite footer with actual total
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, pageHeight - 14, pageWidth, 14, 'F');
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `FCC Transport Report — Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  // Save
  const dateStr = now.toISOString().split('T')[0];
  const filename = `fcc_transport_report_${dateStr}_${reportType}.pdf`;
  onProgress?.('Saving PDF...');
  pdf.save(filename);
}
