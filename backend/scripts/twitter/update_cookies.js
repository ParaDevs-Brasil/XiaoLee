const fs = require('fs');

// New cookies from user
const newCookieString = 'auth_token=b06402fd478d1579c59d5097ae9ce19a63f71143;guest_id=v1%3A174907920976780109;twid=u%3D1930405563571286019;__cf_bm=XHyYljtyfEAcZxgZBeFjJxKHtnYKcSy5XmQRJjcZ1sY-1749141549-1.0.1.1-hfEoMuNGBdLpM_0vDCY0H0tadqjlF.VVj9EJfraYLT99Spul2tYUoAmoR3tHLmbXKPHKrArZF9Yb.SZ6Ar8iLhcVkmwooEZCoVuHG._G1o4;ct0=75867dd53fbb9012a0891ae0082a0468f499c2fd5cddf3e83e664f06369fdc8d26580c37f27981acc974a82742810bd2573ca2a3ff800d375118bb278208538817b755777fd541fbb0af0dad0431a1fd;dnt=1;guest_id_ads=v1%3A174907920976780109;guest_id_marketing=v1%3A174907920976780109;kdt=RYuO6BG4Bz1TDHIGrSpyfajjJO2roi09Spgji5Au;personalization_id="v1_prawffffb5KYuK2eHOyUng=="';

// Parse cookies
const cookies = newCookieString.split(';').map(cookie => {
    const [key, value] = cookie.trim().split('=');
    return {
        key: key,
        value: value.replace(/"/g, ''), // Remove quotes
        domain: 'twitter.com',
        path: '/',
        secure: true,
        httpOnly: false,
        sameSite: 'None'
    };
});

// Save to eliza format
fs.writeFileSync('eliza_cookies_v2.json', JSON.stringify(cookies, null, 2));
console.log('✅ Cookies updated successfully!');
console.log(`   Updated ${cookies.length} cookies`); 