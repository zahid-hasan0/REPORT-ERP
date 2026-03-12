// pdfReport.js
import { showToast } from './toast.js';

// EmailJS Configuration - আপনার keys এখানে বসান
const EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY';     // EmailJS থেকে পাবেন
const SERVICE_ID = 'YOUR_SERVICE_ID';              // EmailJS থেকে পাবেন
const TEMPLATE_ID = 'YOUR_TEMPLATE_ID';            // EmailJS থেকে পাবেন
const RECIPIENT_EMAIL = 'your-email@gmail.com';    // যে email এ পাঠাতে চান

// EmailJS Initialize
(function () {
    if (typeof emailjs !== 'undefined') {
        emailjs.init(EMAILJS_PUBLIC_KEY);
    }
})();

/**
 * Generate PDF Report
 * @param {Array} bookings - Filtered bookings data
 * @param {String} reportType - 'all' or 'monthly'
 * @param {String} monthYear - For monthly report (e.g., "January 2025")
 * @returns {Blob} PDF Blob
 */
export function generatePDFReport(bookings, reportType = 'all', monthYear = '') {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape', 'mm', 'a4');

    // Page dimensions
    const pageWidth = doc.internal.pageSize.getWidth();

    // ========== HEADER ==========
    // Company Logo/Name
    doc.setFillColor(8, 100, 207);
    doc.rect(0, 0, pageWidth, 35, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text('Report Erp', pageWidth / 2, 12, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text('Shardagonj, Kashimpur, Gazipur, Bangladesh', pageWidth / 2, 20, { align: 'center' });

    // Report Title
    const reportTitle = reportType === 'monthly'
        ? `Monthly Booking Report - ${monthYear}`
        : 'Complete Booking Report';

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(reportTitle, pageWidth / 2, 30, { align: 'center' });

    // ========== SUMMARY SECTION ==========
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');

    const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const totalBookings = bookings.length;
    const uniqueCustomers = [...new Set(bookings.map(b => b.customer))].length;
    const uniqueBuyers = [...new Set(bookings.map(b => b.buyer))].length;
    const verifiedCount = bookings.filter(b => b.checkStatus === 'Verified').length;

    doc.text(`Report Generated: ${currentDate}`, 14, 45);
    doc.text(`Total Bookings: ${totalBookings}`, 14, 52);
    doc.text(`Unique Customers: ${uniqueCustomers}`, 80, 52);
    doc.text(`Unique Buyers: ${uniqueBuyers}`, 140, 52);
    doc.text(`Verified: ${verifiedCount}`, 200, 52);

    // ========== TABLE DATA ==========
    const tableData = bookings.map(b => [
        b.bookingNo,
        b.customer,
        b.buyer,
        b.item,
        new Date(b.bookingDate).toLocaleDateString('en-US', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }),
        b.checkStatus || 'Unverified',
        b.checkDate ? new Date(b.checkDate).toLocaleDateString('en-US', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }) : '-',
        b.remarks || '-'
    ]);

    // ========== AUTO TABLE ==========
    doc.autoTable({
        startY: 58,
        head: [['Booking No', 'Customer', 'Buyer', 'Item', 'Booking Date', 'Status', 'Check Date', 'Remarks']],
        body: tableData,
        theme: 'grid',
        headStyles: {
            fillColor: [8, 100, 207],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9,
            halign: 'center'
        },
        bodyStyles: {
            fontSize: 8,
            cellPadding: 3
        },
        alternateRowStyles: {
            fillColor: [245, 247, 250]
        },
        columnStyles: {
            0: { cellWidth: 20, halign: 'center' },
            1: { cellWidth: 35 },
            2: { cellWidth: 35 },
            3: { cellWidth: 40 },
            4: { cellWidth: 25, halign: 'center' },
            5: { cellWidth: 22, halign: 'center' },
            6: { cellWidth: 25, halign: 'center' },
            7: { cellWidth: 35 }
        },
        didDrawCell: function (data) {
            // Color code for Status column
            if (data.column.index === 5 && data.section === 'body') {
                const status = data.cell.raw;
                if (status === 'Verified') {
                    doc.setFillColor(16, 185, 129);
                    doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                    doc.setTextColor(255, 255, 255);
                    doc.text(status, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2, {
                        align: 'center',
                        baseline: 'middle'
                    });
                } else {
                    doc.setFillColor(239, 68, 68);
                    doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                    doc.setTextColor(255, 255, 255);
                    doc.text(status, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2, {
                        align: 'center',
                        baseline: 'middle'
                    });
                }
            }
        },
        margin: { top: 58, bottom: 20, left: 14, right: 14 }
    });

    // ========== FOOTER ==========
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(
            `Page ${i} of ${pageCount}`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'center' }
        );
        doc.text(
            '© 2026 Report ERP and MIS - Automated Booking System',
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 5,
            { align: 'center' }
        );
    }

    return doc.output('blob');
}

/**
 * Download PDF Report
 */
export function downloadPDFReport(bookings, reportType = 'all', monthYear = '') {
    try {
        showToast('Generating PDF...', 'success');

        const pdfBlob = generatePDFReport(bookings, reportType, monthYear);

        const fileName = reportType === 'monthly'
            ? `Booking_Report_${monthYear.replace(/\s/g, '_')}.pdf`
            : `Complete_Booking_Report_${new Date().toISOString().split('T')[0]}.pdf`;

        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);

        showToast('PDF downloaded successfully!', 'success');
    } catch (error) {
        console.error('PDF generation error:', error);
        showToast('Failed to generate PDF', 'error');
    }
}

/**
 * Send PDF Report via Email
 */
export async function emailPDFReport(bookings, reportType = 'all', monthYear = '') {
    if (typeof emailjs === 'undefined') {
        showToast('EmailJS not loaded. Please refresh the page.', 'error');
        return;
    }

    try {
        // Show loading
        showToast('Preparing email...', 'success');

        // Generate PDF
        const pdfBlob = generatePDFReport(bookings, reportType, monthYear);

        // Convert blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(pdfBlob);

        reader.onloadend = async function () {
            const base64data = reader.result.split(',')[1];

            const reportTitle = reportType === 'monthly'
                ? `Monthly Report - ${monthYear}`
                : 'Complete Booking Report';

            const fileName = reportType === 'monthly'
                ? `Booking_Report_${monthYear.replace(/\s/g, '_')}.pdf`
                : `Complete_Report_${new Date().toISOString().split('T')[0]}.pdf`;

            // Email parameters
            const templateParams = {
                to_email: RECIPIENT_EMAIL,
                report_title: reportTitle,
                total_bookings: bookings.length,
                report_date: new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                pdf_content: base64data,
                pdf_filename: fileName
            };

            // Send email
            showToast('Sending email...', 'success');

            const response = await emailjs.send(
                SERVICE_ID,
                TEMPLATE_ID,
                templateParams
            );

            console.log('Email sent successfully:', response);
            showToast('Email sent successfully!', 'success');
        };

    } catch (error) {
        console.error('Email send error:', error);
        showToast('Failed to send email: ' + (error.text || error.message), 'error');
    }
}

// Make functions globally available
window.downloadPDFReport = downloadPDFReport;
window.emailPDFReport = emailPDFReport;