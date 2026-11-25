import { mountApp } from './bootstrap-app';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Funspot root element is missing.');

mountApp(root);
