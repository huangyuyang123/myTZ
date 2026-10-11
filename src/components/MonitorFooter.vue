<script setup>import {config} from '../composables/useTheme.js'</script>
<template><footer><span class="footer-mark">◈</span><a href="https://github.com/huilang-me/CF-Server-Monitor/" target="_blank" rel="noopener">Powered by CF-Server-Monitor</a><span v-if="config.version">v{{config.version}}</span></footer></template>
