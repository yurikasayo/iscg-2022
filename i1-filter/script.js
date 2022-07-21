/**
 * GUI
 */
const GUI = lil.GUI
const gui = new GUI()
const debugObject = {}


/**
 * Capture
 */
let video
window.onload = function() {
    video = document.getElementById("videoInput")

    navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
    }).then(stream => {
        video.srcObject = stream
    }).catch(e => {
        console.log(e)
    })

    video.addEventListener('loadedmetadata', () =>
    {
        video.play();
        if (video.width == 0)
        {
            video.width = video.srcObject.getVideoTracks()[0].getSettings().width
            video.height = video.srcObject.getVideoTracks()[0].getSettings().height
        }
        preprocess()
    })
}


/**
 * Shaders
 */
const vertexShader = `
varying vec2 vUv;

void main()
{
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

    vUv = uv;
}
`

const combineShader = `
uniform sampler2D uTexture;
uniform bool forward;

varying vec2 vUv;

void main()
{
    vec3 c = texture2D(uTexture, vUv).rgb;

    if (forward)
    {
        c.r = c.r > 0.04045 ? pow((c.r + 0.055) / 1.055, 2.4) : c.r / 12.92;
        c.g = c.g > 0.04045 ? pow((c.g + 0.055) / 1.055, 2.4) : c.g / 12.92;
        c.b = c.b > 0.04045 ? pow((c.b + 0.055) / 1.055, 2.4) : c.b / 12.92;
        
        c *= mat3(0.4124, 0.3576, 0.1805,
                  0.2126, 0.7152, 0.0722, 
                  0.0193, 0.1192, 0.9505);
        c /= vec3(0.9505, 1.0, 1.089);

        float fx = c.x > 0.008856 ? pow(c.x, 1.0 / 3.0) : c.x / (903.3 * c.x + 16.0) / 116.0;
        float fy = c.y > 0.008856 ? pow(c.y, 1.0 / 3.0) : c.y / (903.3 * c.y + 16.0) / 116.0;
        float fz = c.z > 0.008856 ? pow(c.z, 1.0 / 3.0) : c.z / (903.3 * c.z + 16.0) / 116.0;
        c = vec3(116.0 * fy - 16.0,
                 500.0 * (fx - fy),
                 200.0 * (fy - fz));
        // c = vec3(c.x / 100.0, 0.5 + 0.5 * (c.y / 127.0), 0.5 + 0.5 * (c.z / 127.0));
    }
    else
    {
        float fy = (c.x + 16.0) / 116.0;
        float fx = fy + (c.y / 500.0);
        float fz = fy - (c.z / 200.0);
        
        c.x = fx > 0.2069 ? pow(fx, 3.0) : 0.001107 * (116.0 * fx - 16.0);
        c.y = fy > 0.2069 ? pow(fy, 3.0) : 0.001107 * (116.0 * fy - 16.0);
        c.z = fz > 0.2069 ? pow(fz, 3.0) : 0.001107 * (116.0 * fz - 16.0);

        c *= vec3(0.9505, 1.0, 1.089);
        c *= mat3(3.134, -1.617, -0.4907,
                  -0.9787, 1.916, 0.003343, 
                  0.07196, -0.2290, 1.406);
        
        c.r = c.r > 0.0031308 ? 1.055 * pow(c.r, 1.0 / 2.4) - 0.055 : 12.92 * c.r;
        c.g = c.g > 0.0031308 ? 1.055 * pow(c.g, 1.0 / 2.4) - 0.055 : 12.92 * c.g;
        c.b = c.b > 0.0031308 ? 1.055 * pow(c.b, 1.0 / 2.4) - 0.055 : 12.92 * c.b;
    }

    gl_FragColor = vec4(c, 1.0);
}
`;

const bilateralShader = `
uniform sampler2D uTexture;
uniform float od;
uniform float or;

varying vec2 vUv;

void main()
{
    vec3 cp = texture2D(uTexture, vUv).rgb;
    float r = ceil(3.0 * max(od, or));

    vec3 c = vec3(0.0);
    vec3 w = vec3(0.0);
    for (float y = -r; y <= r; y++) 
    {
        for (float x = -r; x <= r; x++) 
        {
            vec3 cq = texture2D(uTexture, vUv + vec2(x, y) / resolution.xy).rgb;
            float lenS = length(vec2(x, y));
            vec3 lenR = abs(cp-cq);
            float gd = exp(-(lenS * lenS) / (2.0 * od * od));
            vec3 gq = exp(-(lenR * lenR) / (2.0 * or * or));
            c += cq * gd * gq;
            w += gd * gq;
        }
    }
    c /= w;

    gl_FragColor = vec4(c, 1.0);
}
`

const stylizeShader = `
#define PI 3.14195265

uniform sampler2D uTexture1;
uniform sampler2D uTexture2;
uniform float oe;
uniform float phie;
uniform float q;
uniform float phiq;
uniform bool quantize;

varying vec2 vUv;

void main()
{
    // edge detection
    float or = sqrt(1.6) * oe;
    float r = ceil(3.0 * or);

    float se = 0.0;
    float sr = 0.0;
    for (float y = -r; y <= r; y++) 
    {
        for (float x = -r; x <= r; x++) 
        {
            float lumi = texture2D(uTexture1, vUv + vec2(x, y) / resolution.xy).r;
            float len = length(vec2(x, y));
            float ge = exp(-(len * len) / (2.0 * oe * oe));
            float gr = exp(-(len * len) / (2.0 * or * or));
            se += lumi * ge;
            sr += lumi * gr;
        }
    }
    se /= 2.0 * PI * oe * oe;
    sr /= 2.0 * PI * or * or;

    float d = se - 0.98 * sr;
    float edge = d > 0.0 ? 1.0 : 1.0 + tanh(d * phie);

    // luminance quantization
    vec3 c = texture2D(uTexture2, vUv).rgb;
    if (quantize)
    {
        float near = floor(c.r / 100.0 * q - 0.5) * 100.0 / q;
        float dq = 100.0 / q;

        c.r = near + dq / 2.0 * tanh(phiq * (c.r - near));
    }

    c *= edge;
    gl_FragColor = vec4(c, 1.0);
}
`


/**
 * Base
 */
// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()


/**
 * Sprite
 */
const spriteMaterial = new THREE.SpriteMaterial()
const sprite = new THREE.Sprite(spriteMaterial)
scene.add(sprite)
sprite.position.set(0, 0, -1)


/**
 * Filter
 */
const filterSizes = {
    width: 1,
    height: 1,
    quality: 0.5
}
const sceneFilter = new THREE.Scene()
const cameraFilter = new THREE.Camera()
cameraFilter.position.z = 1
const options = {
    type: THREE.FloatType
}
const target = [
    new THREE.WebGLRenderTarget(1, 1, options), 
    new THREE.WebGLRenderTarget(1, 1, options),
    new THREE.WebGLRenderTarget(1, 1, options)]

const combineMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTexture: { value: null },
        forward: { value: true }
    },
    vertexShader: vertexShader,
    fragmentShader: combineShader
})
const bilateralMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTexture: { value: null },
        od: { value: 3 },
        or: { value: 4.25 }
    },
    vertexShader: vertexShader,
    fragmentShader: bilateralShader
})
const stylizeMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTexture1: { value: null },
        uTexture2: { value: null },
        oe: { value: 3 },
        phie: { value: 3 },
        q: { value: 8 },
        phiq: { value: 5 },
        quantize: { value: true }
    },
    vertexShader: vertexShader,
    fragmentShader: stylizeShader
})
gui.add(filterSizes, 'quality').name('quality').min(0.1).max(1.0).step(0.05).onChange(value =>{
    filterSizes.width = Math.ceil(video.width * filterSizes.quality)
    filterSizes.height = Math.ceil(video.height * filterSizes.quality)

    target[0].setSize(filterSizes.width, filterSizes.height)
    target[1].setSize(filterSizes.width, filterSizes.height)
    target[2].setSize(filterSizes.width, filterSizes.height)
})

gui.add(stylizeMaterial.uniforms.oe, 'value').name('omega e').min(1).max(5).step(0.05)
gui.add(stylizeMaterial.uniforms.phie, 'value').name('phi e').min(0.75).max(5).step(0.05)
gui.add(stylizeMaterial.uniforms.q, 'value').name('q').min(8).max(10).step(1)
gui.add(stylizeMaterial.uniforms.phiq, 'value').name('phi q').min(1).max(10).step(0.05)
gui.add(stylizeMaterial.uniforms.quantize, 'value').name('quantize')


const meshFilter = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), combineMaterial)
sceneFilter.add(meshFilter)

let videoTexture
let preprocessed = false

const preprocess = () =>
{
    filterSizes.width = Math.ceil(video.width * filterSizes.quality)
    filterSizes.height = Math.ceil(video.height * filterSizes.quality)

    target[0].setSize(filterSizes.width, filterSizes.height)
    target[1].setSize(filterSizes.width, filterSizes.height)
    target[2].setSize(filterSizes.width, filterSizes.height)

    combineMaterial.defines.resolution = 'vec2( ' + video.width.toFixed( 1 ) + ', ' + video.height.toFixed( 1 ) + ' )'
    bilateralMaterial.defines.resolution = 'vec2( ' + video.width.toFixed( 1 ) + ', ' + video.height.toFixed( 1 ) + ' )'
    stylizeMaterial.defines.resolution = 'vec2( ' + video.width.toFixed( 1 ) + ', ' + video.height.toFixed( 1 ) + ' )'

    sprite.scale.set(video.width, video.height)
    
    videoTexture = new THREE.VideoTexture(video)

    preprocessed = true
}

const renderFilter = () =>
{
    if (!preprocessed) return 0

    // rgb -> lab
    meshFilter.material = combineMaterial
    combineMaterial.uniforms.uTexture.value = videoTexture
    combineMaterial.uniforms.forward.value = true
    renderer.setRenderTarget(target[0])
    renderer.render(sceneFilter, cameraFilter)

    // abstraction : step 1 / 4
    meshFilter.material = bilateralMaterial
    bilateralMaterial.uniforms.uTexture.value = target[0].texture
    renderer.setRenderTarget(target[1])
    renderer.render(sceneFilter, cameraFilter)

    // abstraction : step 2 / 4
    bilateralMaterial.uniforms.uTexture.value = target[1].texture
    renderer.setRenderTarget(target[0])
    renderer.render(sceneFilter, cameraFilter)

    // abstraction : step 3 / 4
    bilateralMaterial.uniforms.uTexture.value = target[0].texture
    renderer.setRenderTarget(target[2])
    renderer.render(sceneFilter, cameraFilter)

    // abstraction : step 4 / 4
    bilateralMaterial.uniforms.uTexture.value = target[2].texture
    renderer.setRenderTarget(target[1])
    renderer.render(sceneFilter, cameraFilter)

    // stylization
    meshFilter.material = stylizeMaterial
    stylizeMaterial.uniforms.uTexture1.value = target[0].texture
    stylizeMaterial.uniforms.uTexture2.value = target[1].texture
    renderer.setRenderTarget(target[2])
    renderer.render(sceneFilter, cameraFilter)

    // combert
    meshFilter.material = combineMaterial
    combineMaterial.uniforms.uTexture.value = target[2].texture
    combineMaterial.uniforms.forward.value = false
    renderer.setRenderTarget(target[0])
    renderer.render(sceneFilter, cameraFilter)

    sprite.material.map = target[0].texture
    sprite.material.needsUpdate = true

    renderer.setRenderTarget(null)
}


/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

window.addEventListener('resize', () => 
{
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    camera.left = - sizes.width / 2
    camera.right = sizes.width / 2
    camera.top = sizes.height / 2
    camera.bottom = - sizes.height / 2
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})


/**
 * Camera
 */
// Base camera
const camera = new THREE.OrthographicCamera(- sizes.width / 2, sizes.width / 2, sizes.height / 2, - sizes.height / 2, 1, 1000)
scene.add(camera)


/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: false,
})
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setClearColor(0xeeeeee)


/**
 * Animate
 */
const clock = new THREE.Clock()

const tick = () =>
{
    const elapsedTime = clock.getElapsedTime()

    // Render Filter
    renderFilter()

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()