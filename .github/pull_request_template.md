## 📝 loves-to.dev Subdomain Request

Thanks for submitting a request to add a subdomain under `loves-to.dev`!

Please double-check the checklist below before submitting your pull request.

---

### ✅ Requirements

- [ ] My file is located in the `domains/` folder.
- [ ] My filename is all lowercase, alphanumeric, and ends in `.json`.
- [ ] The file includes valid `owner` and `records` fields.
- [ ] The domain I’m requesting is actually pointing to the provided CNAME or IP.
- [ ] I understand that violating the [Terms of Service](https://loves-to.dev/terms) may result in removal.

---

### 📄 Domain Details

**Requested subdomain:**  
`<yourname>.loves-to.dev`

**Target (CNAME or IP):**  
`yourusername.github.io` (example)

---

### 🧾 JSON Format (Reference)

```json
{
  "owner": {
    "username": "yourusername",
    "email": "your@email.com"
  },
  "records": {
    "CNAME": "yourusername.github.io"
  }
}
