// toast.js
/**
 * Minimalist Professional Toast System (Dark Theme)
 */
export function showToast(message, type = "success") {
    let container = document.getElementById("toastContainer");

    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        container.style.cssText = `
            position: fixed;
            top: 24px;
            right: 24px;
            z-index: 100001;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
            max-width: 350px;
            width: 100%;
        `;
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");

    let accentColor = "#10b981"; // success
    let icon = "fa-check-circle";

    if (type === "error") {
        accentColor = "#ef4444";
        icon = "fa-times-circle";
    } else if (type === "info") {
        accentColor = "#3b82f6";
        icon = "fa-info-circle";
    } else if (type === "warning") {
        accentColor = "#f59e0b";
        icon = "fa-exclamation-triangle";
    }

    toast.innerHTML = `
        <div style="width: 4px; background: ${accentColor}; height: 100%; border-radius: 4px 0 0 4px; flex-shrink: 0;"></div>
        <div style="padding: 12px 16px; display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
            <i class="fas ${icon}" style="color: ${accentColor}; font-size: 16px;"></i>
            <span style="color: #f8fafc; font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${message}</span>
        </div>
        <button style="background: none; border: none; color: rgba(255,255,255,0.3); padding: 8px 12px; cursor: pointer; display: flex; align-items: center;">
            <i class="fas fa-times" style="font-size: 10px;"></i>
        </button>
    `;

    toast.style.cssText = `
        position: relative;
        background: #0f172a;
        background: rgba(15, 23, 42, 0.98);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        transform: translateX(120%);
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        pointer-events: auto;
        min-height: 48px;
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.transform = "translateX(0)";
    });

    const removeToast = () => {
        toast.style.transform = "translateX(120%)";
        toast.style.opacity = "0";
        setTimeout(() => { if (container.contains(toast)) container.removeChild(toast); }, 400);
    };

    const timer = setTimeout(removeToast, 4000);
    toast.querySelector('button').onclick = (e) => {
        e.stopPropagation();
        clearTimeout(timer);
        removeToast();
    };
}
