# loves-to.dev

<div align="center">
  <h2>Everyone loves to dev</h2>
  <p>Free <code>*.loves-to.dev</code> subdomains for developers</p>
  
  <a href="https://docs.loves-to.dev">📚 Documentation</a> •
  <a href="#how-to-register">🚀 Get Started</a> •
  <a href="https://github.com/loves-to-dev/loves-to.dev/issues">🐛 Issues</a>
</div>

---

## How to Register

1. **Fork this repository**
2. **Add your domain file** to `/domains/yourusername.json`
3. **Submit a pull request**
4. **Get approved & enjoy!**

### Domain File Format

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
```

## Requirements

- ✅ Filename must match username
- ✅ Lowercase, alphanumeric, hyphens only  
- ✅ Valid email required
- ✅ Point to a real website
- ❌ No reserved words (www, api, admin, etc.)

## Examples

**GitHub Pages:**
```json
{
  "owner": {
    "username": "alice",
    "email": "alice@example.com"
  },
  "records": {
    "CNAME": "alice.github.io"
  }
}
```

**Firebase Hosting:**
```json
{
  "owner": {
    "username": "charlie",
    "email": "charlie@example.com"
  },
  "records": {
    "CNAME": "my-project.web.app"
  }
}
```

**Custom Domain:**
```json
{
  "owner": {
    "username": "dave",
    "email": "dave@example.com"
  },
  "records": {
    "CNAME": "dave.dev"
  }
}
```

## Supported Platforms

| Platform | Difficulty | Setup Guide |
|----------|------------|-------------|
| **GitHub Pages** | ⭐ Easy | [Setup Guide](https://docs.loves-to.dev/github-pages) |
| **Vercel** | ⭐ Easy | [Setup Guide](https://docs.loves-to.dev/vercel) |
| **Netlify** | ⭐ Easy | [Setup Guide](https://docs.loves-to.dev/netlify) |
| **Firebase Hosting** | ⭐ Easy | [Setup Guide](https://docs.loves-to.dev/firebase) |
| **Cloudflare Pages** | ⭐ Easy | [Setup Guide](https://docs.loves-to.dev/cloudflare-pages) |
| **Surge.sh** | ⭐ Easy | [Setup Guide](https://docs.loves-to.dev/surge) |
| **Render** | ⭐⭐ Medium | [Setup Guide](https://docs.loves-to.dev/render) |
| **Railway** | ⭐⭐ Medium | [Setup Guide](https://docs.loves-to.dev/railway) |
| **Fly.io** | ⭐⭐ Medium | [Setup Guide](https://docs.loves-to.dev/fly) |
| **DigitalOcean** | ⭐⭐⭐ Hard | [Setup Guide](https://docs.loves-to.dev/digitalocean) |
| **AWS** | ⭐⭐⭐ Hard | [Setup Guide](https://docs.loves-to.dev/aws) |
| **Custom Server** | ⭐⭐⭐ Hard | [Setup Guide](https://docs.loves-to.dev/custom) |

**Free Platforms:** GitHub Pages, Vercel, Netlify, Firebase, Cloudflare Pages, Surge.sh, Railway (free tier), Render (free tier)

**Paid/VPS Platforms:** DigitalOcean, AWS, Fly.io, Custom servers

## Need Help?

- 📖 **Full Documentation**: [docs.loves-to.dev](https://docs.loves-to.dev)
- 🐛 **Report Issues**: [GitHub Issues](https://github.com/loves-to-dev/loves-to-dev/issues)
- 💬 **Get Support**: [support@loves-to.dev](mailto:support@loves-to.dev)

---

<div align="center">
  <p><strong>Everyone loves to dev</strong></p>
  <p>Made with ❤️ for the developer community</p>
</div>
