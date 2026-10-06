import './styles.scss';
import { initDiary } from './diary';

const app = document.querySelector<HTMLDivElement>('#app');

if (app) initDiary(app);