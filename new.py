import requests

url = "http://127.0.0.1:8080/api/Laundry/send-sms/"

payload = {
    "to_number": "0701396967",
      
    
    "message": "Bulk SMS test from Django script!"
}

headers = {
    "Content-Type": "application/json",
}

res = requests.post(url, json=payload, headers=headers)

print("STATUS:", res.status_code)
print("RESPONSE:", res.json())
