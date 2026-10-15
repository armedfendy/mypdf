// Polyfill harus terpasang sebelum pdf.js merender (Map.getOrInsert).
import './map-upsert-polyfill.js';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from '../pdf.worker?worker&url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
