let API_BASE_URL = "";

if (window.location.hostname === "localhost") {
    API_BASE_URL = "http://127.0.0.1:8080/api";
} else if (window.location.hostname === "cleanpage.shop") {
    API_BASE_URL = "https://cleanpage.shop/api";
} else {
    API_BASE_URL = "https://clean-page-laundry:10000/api";
}

export { API_BASE_URL };
