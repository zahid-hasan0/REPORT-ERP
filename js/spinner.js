const spinner = document.createElement('div');
spinner.id = 'excelSpinner';
spinner.style = `
    display: none;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 30px 40px;
    border-radius: 16px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
    z-index: 10000;
    text-align: center;
`;
spinner.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; gap: 16px;">
        <i class="fas fa-spinner fa-spin" style="font-size: 40px; color: #2563eb;"></i>
        <p style="margin: 0; font-size: 15px; font-weight: 600; color: #1e293b;">Uploading Excel...</p>
        <p style="margin: 0; font-size: 13px; color: #64748b;">Please wait while we process your file</p>
    </div>
`;

// Add overlay
const overlay = document.createElement('div');
overlay.id = 'excelOverlay';
overlay.style = `
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9999;
    backdrop-filter: blur(2px);
`;

document.body.appendChild(overlay);
document.body.appendChild(spinner);

function showSpinner() {
    overlay.style.display = 'block';
    spinner.style.display = 'block';
}

function hideSpinner() {
    overlay.style.display = 'none';
    spinner.style.display = 'none';
}