import { ZigZagFractalStyle } from './styles/ZigZagFractalStyle.js';
import { FractalGeometryStyle } from './styles/FractalGeometryStyle.js';
import { FlowingCurvesStyle } from './styles/FlowingCurvesStyle.js';
import { GeometricGridStyle } from './styles/GeometricGridStyle.js';
import { CrystalSmokeStyle } from './styles/CrystalSmokeStyle.js';
import { NebulaConstellationStyle } from './styles/NebulaConstellationStyle.js';
import { GlitchStyle } from './styles/GlitchStyle.js';
import { SynapticEchoStyle } from './styles/SynapticEchoStyle.js';

class App {
    constructor() {
        this.canvas = document.getElementById('wallpaper-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.styles = {
            'synaptic': SynapticEchoStyle,
            'zigzag': ZigZagFractalStyle,
            'fractal': FractalGeometryStyle,
            'curves': FlowingCurvesStyle,
            'grid': GeometricGridStyle,
            'smoke': CrystalSmokeStyle,
            'nebula': NebulaConstellationStyle,
            'glitch': GlitchStyle
        };
        this.activeStyle = null;
        this.activeStyleKey = 'synaptic';
        this.logData = [];
        this.config = {};

        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.handleResize();
        window.addEventListener('resize', () => this.handleResize());

        // Initial data (Mock for now)
        this.logData = Array.from({ length: 50 }, (_, i) => ({
            hh: Math.floor(i / 2),
            mm: (i * 12) % 60,
            bp: 100 - (i * 2),
            fm: 40 + (i % 20),
            up: i * 1000,
            pt: (i * 15) % 1000
        }));

        this.renderStyleList();
        await this.loadStyle('synaptic');
        this.startLoop();
    }

    setupEventListeners() {
        const menuBtn = document.getElementById('menu-btn');
        const settingsBtn = document.getElementById('settings-btn');
        const leftSidebar = document.getElementById('left-sidebar');
        const rightSidebar = document.getElementById('right-sidebar');
        const overlay = document.getElementById('overlay');

        const toggleLeft = () => {
            leftSidebar.classList.toggle('active');
            overlay.classList.toggle('active');
            rightSidebar.classList.remove('active');
        };

        const toggleRight = () => {
            rightSidebar.classList.toggle('active');
            overlay.classList.toggle('active');
            leftSidebar.classList.remove('active');
        };

        const closeAll = () => {
            leftSidebar.classList.remove('active');
            rightSidebar.classList.remove('active');
            overlay.classList.remove('active');
        };

        menuBtn.addEventListener('click', toggleLeft);
        settingsBtn.addEventListener('click', toggleRight);
        overlay.addEventListener('click', closeAll);
    }

    handleResize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (this.activeStyle) {
            this.activeStyle.width = this.canvas.width;
            this.activeStyle.height = this.canvas.height;
            this.activeStyle.init(this.logData); // Re-init layout on resize
        }
    }

    renderStyleList() {
        const list = document.getElementById('style-list');
        list.innerHTML = '';
        Object.keys(this.styles).forEach(key => {
            const item = document.createElement('div');
            item.className = `nav-item ${key === this.activeStyleKey ? 'active' : ''}`;
            item.innerHTML = `
                <span class="material-icons" style="margin-right:16px">auto_awesome</span>
                <span>${key.charAt(0).toUpperCase() + key.slice(1)}</span>
            `;
            item.onclick = () => this.loadStyle(key);
            list.appendChild(item);
        });
    }

    async loadStyle(key) {
        const StyleClass = this.styles[key];
        this.activeStyleKey = key;
        
        // Load default config from metadata
        const defaultConfig = {};
        StyleClass.metadata.forEach(p => {
            defaultConfig[p.id] = p.default;
        });

        this.activeStyle = new StyleClass({
            ...defaultConfig,
            width: this.canvas.width,
            height: this.canvas.height
        });

        await this.activeStyle.init(this.logData);
        this.renderParams();
        this.renderStyleList(); // Update active state
    }

    renderParams() {
        const container = document.getElementById('params-container');
        container.innerHTML = '';
        const metadata = this.activeStyle.constructor.metadata;

        metadata.forEach(p => {
            const item = document.createElement('div');
            item.className = 'param-item';
            item.innerHTML = `
                <label>${p.name}: <span id="val-${p.id}">${this.activeStyle.config[p.id]}</span></label>
                <input type="range" 
                       min="${p.min}" 
                       max="${p.max}" 
                       step="${p.step || 1}" 
                       value="${this.activeStyle.config[p.id]}">
            `;

            const input = item.querySelector('input');
            input.oninput = (e) => {
                const val = parseFloat(e.target.value);
                document.getElementById(`val-${p.id}`).textContent = val;
                this.activeStyle.config[p.id] = val;
                this.activeStyle.init(this.logData); // Refresh layout
            };

            container.appendChild(item);
        });
    }

    startLoop() {
        const loop = () => {
            if (this.activeStyle) {
                this.activeStyle.process();
                this.activeStyle.render(this.ctx, this.canvas.width, this.canvas.height);
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }
}

new App();
