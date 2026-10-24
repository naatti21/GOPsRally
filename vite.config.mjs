import {defineConfig} from 'vite';
export default defineConfig({root:'v04',base:'/GOPsRally/v04/',build:{outDir:'../dist/v04',emptyOutDir:true,target:'es2022'},server:{port:5173,strictPort:true},preview:{port:4175,strictPort:true}});
