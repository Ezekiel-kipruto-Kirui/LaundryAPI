let BASE_URL = "";
let DEFAULT_URL="http://127.0.0.1:8080/api"
if (window.location.hostname === "cleanpage.shop") {
    BASE_URL = "https://cleanpage.shop/api";
} else {
    BASE_URL = 'https://clean-page-laundry';
}

export let API_BASE_URL =  DEFAULT_URL;
