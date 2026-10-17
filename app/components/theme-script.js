// Sin 'use client': el layout (componente de servidor) necesita el texto del script.
export const THEME_KEY = 'adguard.theme';
export const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Corre antes del primer pintado: aplica la preferencia guardada o, si no hay,
 * la del sistema, para que no se vea un destello del tema equivocado.
 */
export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");var d=t==="dark"||(t!=="light"&&matchMedia("${DARK_QUERY}").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.dataset.theme=t||"system"}catch(e){}})()`;
