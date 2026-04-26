/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  // Configuración para excluir archivos específicos del tracing
  outputFileTracingExcludes: {
    '*': ['**/.next/**', '**/node_modules/**']
  }
};

module.exports = nextConfig;
