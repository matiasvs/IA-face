# 🚀 Guía de Deploy a GitHub Pages

Esta guía te ayudará a desplegar tu aplicación de Face Tracking AR en GitHub Pages para que sea accesible desde internet.

## 📋 Requisitos Previos

- [x] Código ya está en el repositorio
- [x] Workflow de GitHub Actions ya configurado (`.github/workflows/deploy.yml`)
- [ ] Habilitar GitHub Pages en el repositorio

---

## 🔧 Pasos para Hacer Deploy

### 1. Verificar que el código esté en GitHub

Asegúrate de que todos tus cambios estén pusheados al repositorio:

```bash
git status
git add .
git commit -m "Preparar para deploy"
git push origin main
```

> **Nota**: Si tu rama principal se llama `master` en lugar de `main`, usa `master` en el comando.

---

### 2. Habilitar GitHub Pages en el Repositorio

1. Ve a tu repositorio en GitHub: `https://github.com/matiasvs/IA-face`

2. Haz clic en **Settings** (Configuración) en la parte superior

3. En el menú lateral izquierdo, busca y haz clic en **Pages**

4. En la sección **Source** (Origen):
   - Selecciona **GitHub Actions** como fuente
   
   ![GitHub Pages Source](https://docs.github.com/assets/cb-47267/mw-1440/images/help/pages/publishing-source-drop-down.webp)

5. Guarda los cambios

---

### 3. Ejecutar el Deploy

Tienes dos opciones:

#### Opción A: Deploy Automático (Recomendado)
El workflow ya está configurado para ejecutarse automáticamente cuando hagas push a la rama `main`:

```bash
git push origin main
```

#### Opción B: Deploy Manual
1. Ve a tu repositorio en GitHub
2. Haz clic en la pestaña **Actions**
3. Selecciona el workflow **Deploy to GitHub Pages**
4. Haz clic en **Run workflow** (botón azul a la derecha)
5. Selecciona la rama `main` y haz clic en **Run workflow**

---

### 4. Verificar el Deploy

1. Ve a la pestaña **Actions** en tu repositorio
2. Verás el workflow ejecutándose (círculo amarillo 🟡)
3. Espera a que termine (checkmark verde ✅)
4. Si hay errores (X roja ❌), haz clic en el workflow para ver los logs

---

### 5. Acceder a tu Aplicación

Una vez que el deploy esté completo (✅), tu aplicación estará disponible en:

```
https://matiasvs.github.io/IA-face/
```

> **Nota**: Puede tardar unos minutos en estar disponible la primera vez.

---

## 🔍 Verificar el Estado del Deploy

### Ver el URL de tu aplicación:

1. Ve a **Settings** > **Pages** en tu repositorio
2. En la parte superior verás un mensaje como:
   ```
   Your site is live at https://matiasvs.github.io/IA-face/
   ```

### Ver los logs del deploy:

1. Ve a la pestaña **Actions**
2. Haz clic en el último workflow ejecutado
3. Haz clic en los jobs `build` y `deploy` para ver los detalles

---

## ⚠️ Solución de Problemas

### El workflow falla en el paso "Build"

**Problema**: Error al ejecutar `npm run build`

**Solución**:
```bash
# Prueba el build localmente primero
npm install
npm run build

# Si funciona localmente, pushea los cambios
git push origin main
```

### El workflow falla en el paso "Deploy"

**Problema**: Permisos insuficientes

**Solución**:
1. Ve a **Settings** > **Actions** > **General**
2. En **Workflow permissions**, selecciona **Read and write permissions**
3. Guarda y vuelve a ejecutar el workflow

### La página muestra 404

**Problema**: GitHub Pages no está habilitado o la ruta es incorrecta

**Solución**:
1. Verifica que GitHub Pages esté habilitado en **Settings** > **Pages**
2. Asegúrate de que la fuente sea **GitHub Actions**
3. Espera unos minutos y recarga la página

### Los archivos no se cargan (CORS o rutas incorrectas)

**Problema**: Las rutas de los assets no son correctas

**Solución**: Verifica que `vite.config.js` tenga la configuración correcta:
```javascript
export default {
  base: '/IA-face/'  // Nombre de tu repositorio
}
```

---

## 📱 Probar en Dispositivos Móviles

Una vez desplegado, puedes acceder desde tu móvil:

1. Abre el navegador en tu teléfono
2. Ve a `https://matiasvs.github.io/IA-face/`
3. Acepta los permisos de cámara cuando se soliciten
4. ¡Disfruta del face tracking AR!

> **Importante**: GitHub Pages usa HTTPS, por lo que la cámara funcionará correctamente en dispositivos móviles.

---

## 🔄 Actualizar la Aplicación

Para actualizar tu aplicación desplegada:

1. Haz cambios en tu código local
2. Commitea y pushea:
   ```bash
   git add .
   git commit -m "Actualización de funcionalidad"
   git push origin main
   ```
3. El workflow se ejecutará automáticamente
4. En unos minutos, los cambios estarán en vivo

---

## ✅ Checklist Final

- [ ] Código pusheado a GitHub
- [ ] GitHub Pages habilitado en Settings
- [ ] Workflow ejecutado exitosamente
- [ ] Aplicación accesible en `https://matiasvs.github.io/IA-face/`
- [ ] Probado en navegador de escritorio
- [ ] Probado en dispositivo móvil

---

## 📚 Recursos Adicionales

- [Documentación de GitHub Pages](https://docs.github.com/es/pages)
- [Documentación de GitHub Actions](https://docs.github.com/es/actions)
- [Documentación de Vite Deploy](https://vitejs.dev/guide/static-deploy.html#github-pages)
