// services/url.ts

// Determine the base URL based on the current hostname
let API_BASE_URL: string;

const currentHostname = window.location.hostname;

// Local development environments
const isLocalhost = currentHostname === "localhost" || 
                    currentHostname === "127.0.0.1";

// Production domain
const isProduction = currentHostname === "cleanpage.shop" || 
                     currentHostname === "www.cleanpage.shop" ||
                     currentHostname.includes("cleanpage.shop");

// Set API URL based on environment
if (isLocalhost) {
    // Local development
    API_BASE_URL = "http://127.0.0.1:8080/api";
} else if (isProduction) {
    // Production
    API_BASE_URL = "https://cleanpage.shop/api";
} else {
    // Staging/Testing (if you have other domains)
    // You can add specific staging domains here
    if (currentHostname.includes("staging")) {
        API_BASE_URL = `https://${currentHostname}/api`;
    } else {
        // Fallback - try to infer from current location
        API_BASE_URL = `${window.location.protocol}//${currentHostname}/api`;
    }
}
export { API_BASE_URL };