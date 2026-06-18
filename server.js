const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const root = __dirname;

app.use(express.static(root));

app.get('*', (req, res) => {
    const filePath = path.join(root, 'index.html');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('ERROR: index.html no encontrado en ' + root);
    }
});

app.listen(PORT, () => {
    console.log(`Mali corriendo en http://localhost:${PORT}`);
    console.log('Root:', root);
    console.log('index.html exists:', fs.existsSync(path.join(root, 'index.html')));
    console.log('oauth-callback.html exists:', fs.existsSync(path.join(root, 'pages', 'oauth-callback.html')));
});
