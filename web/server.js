import Koa from 'koa';
import serve from 'koa-static';
import mount from 'koa-mount';
import Router from '@koa/router';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const WALLPAPERS_DIR = path.join(PROJECT_ROOT, 'my_wallpapers');

const app = new Koa();
const router = new Router();

// API to list wallpapers
router.get('/api/wallpapers', async (ctx) => {
    try {
        const files = await fs.readdir(WALLPAPERS_DIR);
        // Filter for images and sort by newest (assuming they have numbers/timestamps)
        const wallpapers = files
            .filter(f => f.endsWith('.png') || f.endsWith('.jpg'))
            .sort((a, b) => {
                // Try to extract numbers for sorting if available
                const numA = parseInt(a.match(/\d+/)?.[0] || 0);
                const numB = parseInt(b.match(/\d+/)?.[0] || 0);
                return numB - numA;
            });
        
        ctx.body = wallpapers.map(filename => ({
            name: filename,
            url: `/my_wallpapers/${filename}`
        }));
    } catch (err) {
        ctx.status = 500;
        ctx.body = { error: 'Could not read wallpapers directory' };
    }
});

app.use(router.routes()).use(router.allowedMethods());

// Serve static files from public/
app.use(serve(path.join(__dirname, 'public')));

// Mount the wallpapers directory so they can be accessed via /my_wallpapers/
app.use(mount('/my_wallpapers', serve(WALLPAPERS_DIR)));

const PORT = 3000;
console.log(`WallGen Live Server running on http://localhost:${PORT}`);
console.log(`Gallery API: http://localhost:${PORT}/api/wallpapers`);
app.listen(PORT);
