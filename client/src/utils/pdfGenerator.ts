import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface PdfOptions {
  title: string;
  dateRange: string;
  reportType: 'global' | 'individual';
  transporterName?: string;
}

/**
 * Convert all SVG elements inside a container to canvas elements
 * so html2canvas can capture them reliably.
 * Returns a cleanup function to restore original SVGs.
 */
function convertSvgsToCanvas(container: HTMLElement): () => void {
  const svgs = container.querySelectorAll('svg');
  const restorations: Array<() => void> = [];

  svgs.forEach((svg) => {
    try {
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const canvas = document.createElement('canvas');
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        URL.revokeObjectURL(url);
      };
      img.src = url;

      const parent = svg.parentNode;
      if (parent) {
        parent.replaceChild(canvas, svg);
        restorations.push(() => {
          parent.replaceChild(svg, canvas);
        });
      }
    } catch {
      // Skip SVGs that can't be converted
    }
  });

  return () => restorations.forEach((restore) => restore());
}

/**
 * Wait for all SVG-to-canvas Image loads to complete.
 */
async function waitForSvgConversion(container: HTMLElement): Promise<void> {
  const svgs = container.querySelectorAll('svg');
  if (svgs.length === 0) return;

  // convertSvgsToCanvas is sync for the DOM replacement but images load async.
  // Give the images time to load and render.
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}

export async function generatePdf(
  container: HTMLElement,
  options: PdfOptions,
  onProgress?: (msg: string) => void
): Promise<void> {
  const { dateRange, reportType, transporterName } = options;

  onProgress?.('Preparing PDF layout...');

  // Convert SVGs to canvas for reliable capture
  const restoreSvgs = convertSvgsToCanvas(container);
  // Wait for image loads from SVG conversion
  await new Promise((r) => setTimeout(r, 300));
  await waitForSvgConversion(container);

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const footerSpace = 14;
  const usableHeight = pageHeight - margin - footerSpace;
  let currentY = margin;
  let pageNum = 1;

  const addNewPage = () => {
    pdf.addPage();
    pageNum++;
    currentY = margin;
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

    const imgWidth = contentWidth;
    const imgHeight = (canvas.height / canvas.width) * imgWidth;
    const availableOnPage = usableHeight - currentY;

    if (imgHeight <= availableOnPage) {
      // Fits on current page
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', margin, currentY, imgWidth, imgHeight);
      currentY += imgHeight + 6;
    } else if (imgHeight <= usableHeight - margin) {
      // Doesn't fit here but fits on a fresh page
      addNewPage();
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', margin, currentY, imgWidth, imgHeight);
      currentY += imgHeight + 6;
    } else {
      // Section is taller than one page — split across pages
      const pxPerMm = canvas.height / imgHeight;
      let srcY = 0;

      while (srcY < canvas.height) {
        if (currentY > margin + 1) {
          // If we're not at the top of a page, start a new one for the chunk
          addNewPage();
        }

        const availableMm = usableHeight - currentY;
        const availablePx = availableMm * pxPerMm;
        const chunkPx = Math.min(availablePx, canvas.height - srcY);
        const chunkMm = chunkPx / pxPerMm;

        // Create a sub-canvas for this chunk
        const chunkCanvas = document.createElement('canvas');
        chunkCanvas.width = canvas.width;
        chunkCanvas.height = Math.ceil(chunkPx);
        const chunkCtx = chunkCanvas.getContext('2d');
        if (chunkCtx) {
          chunkCtx.drawImage(
            canvas,
            0, srcY, canvas.width, chunkPx,
            0, 0, canvas.width, chunkPx
          );
          const chunkData = chunkCanvas.toDataURL('image/png');
          pdf.addImage(chunkData, 'PNG', margin, currentY, imgWidth, chunkMm);
        }

        currentY += chunkMm + 2;
        srcY += chunkPx;
      }
    }
  }

  // Restore original SVGs
  restoreSvgs();

  // Write page footers with actual total
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, pageHeight - footerSpace, pageWidth, footerSpace, 'F');
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
