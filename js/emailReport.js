// emailReport.js
import { showToast } from './toast.js';

const EMAILJS_CONFIG = {
    PUBLIC_KEY: 'SWjIhUTGpjL0nY58F',
    SERVICES: {
        GMAIL: {
            SERVICE_ID: 'service_imq99a4',
            TEMPLATE_ID: 'template_4fio8or',
            NAME: 'Gmail'
        },
        OUTLOOK: {
            SERVICE_ID: 'service_flc2jfy',
            TEMPLATE_ID: 'template_4fio8or',
            NAME: 'Outlook'
        }
    }
};

/**
 * Check if EmailJS is properly configured
 */
function isEmailJSConfigured() {
    const hasGmail = EMAILJS_CONFIG.SERVICES.GMAIL.SERVICE_ID && EMAILJS_CONFIG.SERVICES.GMAIL.TEMPLATE_ID;
    const hasOutlook = EMAILJS_CONFIG.SERVICES.OUTLOOK.SERVICE_ID && EMAILJS_CONFIG.SERVICES.OUTLOOK.TEMPLATE_ID;

    if (!hasGmail && !hasOutlook) {
        console.error('❌ EmailJS not configured!');
        showToast('No email service configured. Please configure at least one service.', 'error');
        return false;
    }
    return true;
}


function generateBuyerReportHTML(bookings, selectedMonth, selectedYear) {
    // Filter bookings based on month and year
    let filteredBookings = bookings;

    if (selectedMonth && selectedMonth !== 'all') {
        filteredBookings = filteredBookings.filter(b => {
            const date = new Date(b.bookingDate);
            return (date.getMonth() + 1).toString() === selectedMonth;
        });
    }

    if (selectedYear && selectedYear !== 'all') {
        filteredBookings = filteredBookings.filter(b => {
            const date = new Date(b.bookingDate);
            return date.getFullYear().toString() === selectedYear;
        });
    }

    // Group bookings by buyer
    const buyerData = {};

    filteredBookings.forEach(b => {
        const buyer = b.buyer.trim();
        if (!buyerData[buyer]) {
            buyerData[buyer] = {
                totalBookings: 0,
                customers: new Set(),
                items: new Set()
            };
        }
        buyerData[buyer].totalBookings++;
        buyerData[buyer].customers.add(b.customer);
        buyerData[buyer].items.add(b.item);
    });

    // Sort buyers by total bookings (descending)
    const sortedBuyers = Object.entries(buyerData)
        .sort((a, b) => b[1].totalBookings - a[1].totalBookings);

    // Generate report period text
    const monthNames = {
        '1': 'January', '2': 'February', '3': 'March', '4': 'April',
        '5': 'May', '6': 'June', '7': 'July', '8': 'August',
        '9': 'September', '10': 'October', '11': 'November', '12': 'December',
        'all': 'All'
    };

    let reportPeriod = '';
    const monthText = selectedMonth === 'all' ? 'All Months' : monthNames[selectedMonth];
    const yearText = selectedYear === 'all' ? 'All Years' : selectedYear;

    if (selectedMonth === 'all' && selectedYear === 'all') {
        reportPeriod = 'All Time';
    } else {
        reportPeriod = `${monthText} ${yearText}`;
    }

    // Generate HTML
    let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { 
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
            background-color: #b9bfc9ff; 
            margin: 0; 
            padding: 40px 20px; 
            color: #333;
        }
        .container { 
            max-width: 800px; 
            margin: 0 auto; 
            background: #3b82f6; 
            border-radius: 16px; 
            overflow: hidden; 
            box-shadow: 0 10px 25px rgba(0,0,0,0.1); 
        }
        .header { 
            background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); 
            color: white; 
            padding: 20px; 
            text-align: center; 
            position: relative;
        }
        .header h1 { 
            margin: 0; 
            font-size: 32px; 
            font-weight: 800; 
            letter-spacing: 0.5px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .header p { 
            margin: 10px 0 0; 
            font-size: 16px; 
            opacity: 0.9; 
            font-weight: 500;
        }
        .summary-section {
            padding: 30px 40px;
            background-color: #3b82f6;
            border-bottom: 1px solid #e2e8f0;
        }
        .summary-card {
            background: white;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
            border: 1px solid #e2e8f0;
            max-width: 200px;
            margin: 0 auto;
        }
        .summary-card h3 {
            margin: 0 0 8px;
            font-size: 15px;
            color: #ff0000ff;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 600;
        }
        .summary-card p {
            margin: 0;
            font-size: 32px;
            font-weight: 800;
            color: #1e3a8a;
        }
        .table-container { 
            padding: 40px; 
        }
        table { 
            width: 100%; 
            border-collapse: separate; 
            border-spacing: 0; 
            border: 1px solid #000000ff;
            border-radius: 12px;
            overflow: hidden;
            background-color:#ffffff;
        }
        th { 
            background: #f1f5f9; 
            padding: 16px; 
            text-align: left; 
            font-size: 13px; 
            font-weight: 700;
            color: #000000ff; 
            text-transform: uppercase; 
            letter-spacing: 0.5px;
            border-bottom: 2px solid #cbd5e1; 
        }
            tr{
                border:1px solid black;
            }
        td { 
            padding: 16px; 
            border-bottom: 1px solid #f1f5f9; 
            font-size: 15px; 
            color: #334155; 
            vertical-align: middle;
        }
        tr:last-child td {
            border-bottom: none;
        }
        tr:nth-child(even) { 
            background-color: #f8fafc; 
        }
        tr:hover { 
            background-color: #f1f5f9; 
        }
        .rank-badge {
            display: inline-block;
            width: 28px;
            height: 28px;
            line-height: 28px;
            background: #e2e8f0;
            color: #475569;
            border-radius: 50%;
            text-align: center;
            font-weight: bold;
            font-size: 13px;
        }
        .top-rank {
            background: #fef3c7;
            color: #d97706;
        }
        .buyer-name {
            font-weight: 600;
            color: #1e293b;
        }
        .count-badge { 
            background: #eff6ff;
            color: #2563eb;
            padding: 6px 12px;
            border-radius: 20px;
            font-weight: 700;
            font-size: 14px;
            display: inline-block;
        }
        .footer { 
            background: #f8fafc; 
            padding: 30px; 
            text-align: center; 
            color: #94a3b8; 
            font-size: 13px; 
            border-top: 1px solid #e2e8f0;
        }
        .footer p {
            margin: 5px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Brand Wise Booking Summary</h1>
            <p style="color:#ffffff; font-weight:600; font-size:20px;">${reportPeriod}</p>
        </div>
        
        <div class="summary-section">
            <div class="summary-card">
                <h3>Total Bookings</h3>
                <p>${filteredBookings.length}</p>
            </div>
        </div>

        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th style="width: 80px; text-align: center;">Rank</th>
                        <th>Brand Name</th>
                        <th style="text-align: right;">Total Bookings</th>
                    </tr>
                </thead>
                <tbody>
    `;

    sortedBuyers.forEach(([buyer, data], index) => {
        const rankClass = index < 3 ? 'top-rank' : '';
        html += `
                    <tr>
                        <td style="text-align: center;">
                            <span class="rank-badge ${rankClass}">${index + 1}</span>
                        </td>
                        <td>
                            <span class="buyer-name">${buyer}</span>
                        </td>
                        <td style="text-align: right;">
                            <span class="count-badge">${data.totalBookings}</span>
                        </td>
                    </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>

        <div class="footer">
            <p>Generated by <strong>Report Erp System</strong></p>
            <p>${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
    </div>
</body>
</html>
    `;

    return html;
}

async function sendEmailWithFilter() {
    // Check if EmailJS is initialized
    if (typeof emailjs === 'undefined') {
        console.error('❌ EmailJS library not loaded');
        showToast('EmailJS library not loaded. Please check internet connection.', 'error');
        return;
    }

    const recipientEmail = document.getElementById('recipientEmail').value.trim();
    const selectedMonth = document.getElementById('emailMonth').value;
    const selectedYear = document.getElementById('emailYear').value;
    const selectedService = document.getElementById('emailService').value; // Get selected service

    if (!recipientEmail) {
        showToast('Please enter recipient email address', 'error');
        return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }

    // Get bookings from global scope
    const bookings = window.bookings || [];

    if (!bookings.length) {
        showToast('No bookings data available', 'error');
        return;
    }

    const sendBtn = document.getElementById('sendEmailBtn');
    const originalBtnContent = sendBtn ? sendBtn.innerHTML : '';

    try {
        // Show spinner
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Sending...';
        }
        showToast('Preparing email...', 'success');

        // Generate report HTML
        const reportHTML = generateBuyerReportHTML(bookings, selectedMonth, selectedYear);

        const monthNames = {
            '1': 'January', '2': 'February', '3': 'March', '4': 'April',
            '5': 'May', '6': 'June', '7': 'July', '8': 'August',
            '9': 'September', '10': 'October', '11': 'November', '12': 'December',
            'all': 'All'
        };

        const monthText = selectedMonth === 'all' ? 'All Months' : monthNames[selectedMonth];
        const yearText = selectedYear === 'all' ? 'All Years' : selectedYear;
        const reportPeriod = (selectedMonth === 'all' && selectedYear === 'all') ? 'All Time' : `${monthText} ${yearText}`;

        // Email parameters for EmailJS
        const templateParams = {
            to_email: recipientEmail,
            subject: `Brand Wise Summary Report - ${reportPeriod}`,
            report_period: reportPeriod,
            report_html: reportHTML,
            generated_date: new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })
        };

        // Determine Service ID based on selection
        const serviceConfig = EMAILJS_CONFIG.SERVICES[selectedService];
        const serviceId = serviceConfig.SERVICE_ID;
        const templateId = serviceConfig.TEMPLATE_ID;

        console.log('📧 Sending email with params:', {
            service: serviceConfig.NAME,
            serviceId: serviceId,
            templateId: templateId,
            to: recipientEmail
        });

        showToast(`Sending email via ${serviceConfig.NAME}...`, 'success');

        // Send email using EmailJS
        const response = await emailjs.send(
            serviceId,
            templateId,
            templateParams,
            EMAILJS_CONFIG.PUBLIC_KEY
        );
        showToast(` Email sent successfully via ${serviceConfig.NAME} to ${recipientEmail}`, 'success');
        console.log('✅ Email sent successfully:', response);
        // showToast(`✅ Email sent successfully via ${serviceConfig.NAME} to ${recipientEmail}`, 'success');

        // Clear email input
        document.getElementById('recipientEmail').value = '';

    } catch (error) {
        console.error('❌ Email send error:', error);

        // Better error messages
        let errorMessage = 'Failed to send email';

        if (error.status === 400) {
            errorMessage = 'EmailJS configuration error. Service ID or Template ID may be incorrect.';
            console.error('Check your EmailJS Dashboard: https://dashboard.emailjs.com/admin');
        } else if (error.status === 412) {
            errorMessage = 'Template not found. Please check Template ID.';
        } else if (error.status === 413) {
            errorMessage = 'Report is still too large. Please download instead.';
        } else if (error.text) {
            errorMessage = error.text;
        } else if (error.message) {
            errorMessage = error.message;
        }

        showToast(errorMessage, 'error');
    } finally {
        // Restore button state
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalBtnContent;
        }
    }
}


function downloadWithFilter() {
    const selectedMonth = document.getElementById('emailMonth').value;
    const selectedYear = document.getElementById('emailYear').value;

    const bookings = window.bookings || [];

    if (!bookings.length) {
        showToast('No bookings data available', 'error');
        return;
    }

    try {
        showToast('Generating report...', 'success');

        // Generate report HTML
        const reportHTML = generateBuyerReportHTML(bookings, selectedMonth, selectedYear);

        // Create blob and download
        const blob = new Blob([reportHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        let filename = 'Buyer_Summary_';
        if (selectedMonth === 'all' && selectedYear === 'all') {
            filename += 'All_Time';
        } else {
            filename += `${selectedMonth}_${selectedYear}`;
        }
        filename += '.html';

        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        showToast('Report downloaded successfully', 'success');

    } catch (error) {
        console.error('Download error:', error);
        showToast('Failed to download report', 'error');
    }
}

// Make functions globally available
window.sendEmailWithFilter = sendEmailWithFilter;
window.downloadWithFilter = downloadWithFilter;

// Show configuration status on load
console.log('📧 EmailJS Configuration Status:', {
    PUBLIC_KEY: EMAILJS_CONFIG.PUBLIC_KEY ? '✅ Set' : '❌ Missing',
    'Gmail Service': EMAILJS_CONFIG.SERVICES.GMAIL.SERVICE_ID ? '✅ Configured' : '❌ Not Configured',
    'Outlook Service': EMAILJS_CONFIG.SERVICES.OUTLOOK.SERVICE_ID ? '✅ Configured' : '❌ Not Configured'
});