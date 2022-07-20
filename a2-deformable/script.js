/**
 * Base
 */
// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()


/**
 * Shaders
 */
const velocityComputeShader = `
uniform sampler2D positionTexture;
uniform sampler2D velocityTexture;
uniform sampler2D invMassTexture;
uniform sampler2D edgeTexture;

uniform vec3 gravity;

uniform int forceMode;

uniform float dataWidth;
uniform float k;
uniform float kd;
uniform float kc;
uniform float dt;

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    float invMass = texture2D(invMassTexture, uv).x;
    vec3 p = texture2D(positionTexture, uv).xyz;
    vec3 v = texture2D(velocityTexture, uv).xyz;

    vec3 dv = gravity;
    for (float i = 0.0; i < 1.0; i += 1.0 / dataWidth) {
        vec2 data = texture2D(edgeTexture, vec2(i, uv.y)).xy;
        if (data.x < 0.0) break;
        
        vec2 uv1 = vec2(uv.x, data.x / resolution.y);
        vec3 p1 = texture2D(positionTexture, uv1).xyz;
        vec3 v1 = texture2D(velocityTexture, uv1).xyz;

        vec3 grad = p - p1;
        float len = length(grad);
        grad /= len;
        
        dv += -invMass * k * grad * (len - data.y);
        dv += -invMass * kd * grad * dot(grad, v-v1);
    }
    
    if (texture2D(invMassTexture, uv).y > 0.0) {
        vec3 force = vec3(0.0);
        vec2 xz = texture2D(invMassTexture, uv).zw;
        switch (forceMode) {
        case 1:
            force = vec3(5.0, 0.0, 0.0);
            break;
        case 2:
            force = vec3(-5.0, 0.0, 0.0);
            break;
        case 3:
            force = vec3(0.0, 20.0, 0.0);
            break;
        case 4:
            force = vec3(0.0, -15.0, 0.0);
            break;
        case 5:
            force = vec3(-20.0 * xz.y, 0.0, 20.0 * xz.x);
            break;
        case 6:
            force = vec3(20.0 * xz.y, 0.0, -20.0 * xz.x);
            break;
        }
        dv += force * invMass;
    }

    if (p.y < 0.0) {
        dv.y += -invMass * kc * p.y;
    }

    v += dt * dv;

    gl_FragColor = vec4(v, 1.0);
}
`

const positionComputeShader = `
uniform sampler2D positionTexture;
uniform sampler2D velocityTexture;
uniform sampler2D invMassTexture;

uniform float dt;

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    float invMass = texture2D(invMassTexture, uv).x;
    vec3 p = texture2D(positionTexture, uv).xyz;

    if (invMass > 0.0) {
        vec3 v = texture2D(velocityTexture, uv).xyz;
        p += dt * v;
    }

    gl_FragColor = vec4(p, 0.0);
}
`


/**
 * Parameters
 */
const k  = 200.0
const kd = 0.001
const kc = 1000.0
const dt = 1.0 / 60.0
const numSteps = 150
const sdt = dt / numSteps
const gravity = new THREE.Vector3(0, -9.8, 0)
const force = new THREE.Vector3(0, 0, 0)
const dataWidth = 32


/**
 * Load Mesh
 */
const loader = new THREE.FileLoader()

const loadMesh = (msh, obj) =>
{
    const mshLines = msh.split('\n')
    const objLines = obj.split('\n')

    const vertices = []
    const neighbers = []
    const invMasses = []

    const surfIds = []
    const faceIds = []
    
    for (let i = 0; i < mshLines.length; i++)
    {
        const segments = mshLines[i].split(' ')
        
        if (segments.length == 4)
        {
            const v = new THREE.Vector3(parseFloat(segments[1]), parseFloat(segments[2]), parseFloat(segments[3]))
            vertices.push(v)
            
            neighbers.push([])
            invMasses.push(0)
        }
        else if (segments.length == 8)
        {
            const ids = [parseFloat(segments[3])-1, parseFloat(segments[4])-1, parseFloat(segments[5])-1, parseFloat(segments[6])-1]
            
            const v1 = new THREE.Vector3()
            const v2 = new THREE.Vector3()
            v1.subVectors(vertices[ids[1]], vertices[ids[0]])
            v2.subVectors(vertices[ids[2]], vertices[ids[0]])
            v1.cross(v2)
            v2.subVectors(vertices[ids[3]], vertices[ids[0]])
            const tetraVolume = v1.dot(v2)
            const invMass = tetraVolume > 0.0 ? 1.0 / (tetraVolume / 4) : 0.0
            
            for (let j = 0; j < 4; j++)
            {
                invMasses[ids[j]] += invMass

                let isListed = [false, false, false]
                for (let k = 0; k < neighbers[ids[j]].length; k++)
                {
                    for (let l = 0; l < 3; l++)
                    {
                        isListed[l] = isListed[l] || ids[(j+l+1)%4] == neighbers[ids[j]][k].id
                    }
                }

                for (let l = 0; l < 3; l++)
                {
                    if (isListed[l]) continue
                    const edgeLength = vertices[ids[j]].distanceTo(vertices[ids[(j+l+1)%4]])
                    neighbers[ids[j]].push({id: ids[(j+l+1)%4], length: edgeLength})
                }
            }
        }
    }

    for (let i = 0; i < objLines.length; i++)
    {
        const segments = objLines[i].split(' ')
        if (segments.length == 0) continue

        if (segments[0] == 'v')
        {
            const v = new THREE.Vector3(parseFloat(segments[1]), parseFloat(segments[2]), parseFloat(segments[3]))

            for (let j = 0; j < vertices.length; j++)
            {
                const dist = v.distanceTo(vertices[j])

                if (dist < 1e-3)
                {
                    surfIds.push(j)
                    break
                }
            }
        } else if (segments[0] ==  'f')
        {
            faceIds.push(surfIds[parseFloat(segments[1])-1], surfIds[parseFloat(segments[2])-1], surfIds[parseFloat(segments[3])-1])
        }
    }

    return { v: vertices, v2v: neighbers, invM: invMasses, f: faceIds }
}

let msh, obj;
loader.load('./mesh/roundBar.msh', (text) => { msh = text })
loader.load('./mesh/roundBar.obj', (text) => { obj = text })

let meshData = null
THREE.DefaultLoadingManager.onLoad = () =>
{
    meshData = loadMesh(msh, obj)
}


/**
 * Create constant textures
 */
let numVertices
let invMassTexture
let edgeTexture

const setData = () =>
{
    numVertices = meshData.v.length

    let invMassData = new Float32Array(4 * numVertices)
    let edgeData = new Float32Array(4 * dataWidth * numVertices)

    invMassData.fill(0)
    edgeData.fill(-1)

    for (let i = 0; i < numVertices; i++)
    {
        invMassData[4 * i + 0] = meshData.v[i].y < 0.0 ? 0 : meshData.invM[i]
        if (meshData.v[i].y > 9.99)
        {
            invMassData[4 * i + 1] = 1
            invMassData[4 * i + 2] = meshData.v[i].x
            invMassData[4 * i + 3] = meshData.v[i].z
        }
        invMassData[4 * i + 1] = meshData.v[i].y > 9.99 ? 1 : -1
        for (let j = 0; j < meshData.v2v[i].length; j++)
        {
            edgeData[4 * (i * dataWidth + j) + 0] = meshData.v2v[i][j].id
            edgeData[4 * (i * dataWidth + j) + 1] = meshData.v2v[i][j].length
            edgeData[4 * (i * dataWidth + j) + 2] = 0
            edgeData[4 * (i * dataWidth + j) + 3] = 0
        }
    }

    invMassTexture = new THREE.DataTexture(invMassData, 1, numVertices, THREE.RGBAFormat, THREE.FloatType)
    edgeTexture = new THREE.DataTexture(edgeData, dataWidth, numVertices, THREE.RGBAFormat, THREE.FloatType)
    invMassTexture.needsUpdate = true
    edgeTexture.needsUpdate = true
}


/**
 * Create mesh
 */
let mesh
let geometry
let positionAttributes

const material = new THREE.MeshStandardMaterial({
    color: 0xff6600,
    transparent: true,
    roughness: 0.2,
})

const createMesh = () => {
    geometry = new THREE.BufferGeometry()

    positionAttributes = new Float32Array(numVertices * 4)
    for (let i = 0; i < numVertices; i++) 
    {
        positionAttributes[i * 4 + 0] = meshData.v[i].x
        positionAttributes[i * 4 + 1] = meshData.v[i].y
        positionAttributes[i * 4 + 2] = meshData.v[i].z
        positionAttributes[i * 4 + 3] = 0
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positionAttributes, 4))
    geometry.setIndex(meshData.f)
    geometry.computeVertexNormals()

    mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)
    mesh.castShadow = true
}


/**
 * Plane
 */
const planeGeometry = new THREE.PlaneGeometry(1000, 1000)
const planeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff })
const plane = new THREE.Mesh(planeGeometry, planeMaterial)
scene.add(plane)
plane.rotation.x = -Math.PI / 2
plane.position.y = 0
plane.receiveShadow = true


/**
 * Lights
 */
const ambientLight = new THREE.AmbientLight(0xffddaa, 0.5)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6)
directionalLight.castShadow = true
directionalLight.shadow.mapSize.set(1024, 1024)
directionalLight.shadow.camera.far = 40
directionalLight.shadow.camera.left = - 20
directionalLight.shadow.camera.top = 20
directionalLight.shadow.camera.right = 20
directionalLight.shadow.camera.bottom = - 20
directionalLight.position.set(10, 14, 12)
scene.add(directionalLight)

// const directionalLightCameraHelper = new THREE.CameraHelper(directionalLight.shadow.camera)
// scene.add(directionalLightCameraHelper)


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
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})


/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 1, 200)
camera.position.set(0, 10, 20)
scene.add(camera)

// Controls
const controls = new THREE.OrbitControls(camera, canvas)
controls.enableDamping = true
controls.dampingFactor = 0.1


/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas
})
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setClearColor(0xbbeeff)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap


/**
 * Compute Renderer
 */
let computeRenderer

let positionVariable
let velocityVariable

const createFbos = () => 
{
    computeRenderer = new THREE.GPUComputationRenderer(1, numVertices, renderer)

    // create fbos
    const position = computeRenderer.createTexture()
    const velocity = computeRenderer.createTexture()

    // init fbos
    position.image.data = positionAttributes.slice()

    // fbo variables
    positionVariable = computeRenderer.addVariable("positionTexture", positionComputeShader, position)
    velocityVariable = computeRenderer.addVariable("velocityTexture", velocityComputeShader, velocity)

    // set uniforms
    positionVariable.material.uniforms['positionTexture'] = { value: position }
    positionVariable.material.uniforms['velocityTexture'] = { value: velocity }
    positionVariable.material.uniforms['invMassTexture'] = { value: invMassTexture }
    positionVariable.material.uniforms['dt'] = { value: sdt }

    velocityVariable.material.uniforms['positionTexture'] = { value: position }
    velocityVariable.material.uniforms['velocityTexture'] = { value: velocity }
    velocityVariable.material.uniforms['invMassTexture'] = { value: invMassTexture }
    velocityVariable.material.uniforms['edgeTexture'] = { value: edgeTexture }
    velocityVariable.material.uniforms['dataWidth'] = { value: dataWidth }
    velocityVariable.material.uniforms['gravity'] = { value: gravity }
    velocityVariable.material.uniforms['forceMode'] = { value: 0 }
    velocityVariable.material.uniforms['k'] = { value: k }
    velocityVariable.material.uniforms['kd'] = { value: kd }
    velocityVariable.material.uniforms['kc'] = { value: kc }
    velocityVariable.material.uniforms['dt'] = { value: sdt }

    // init compute renderer
    const e = computeRenderer.init()
    if (e !== null) console.log(e)
}


/** 
 * Simulate
*/
let preprocessed = false

const simulate = () => 
{
    if (!preprocessed)
    {
        setData()
        createMesh()
        createFbos()
        preprocessed = true
    }

    velocityVariable.material.uniforms['k'].value = slider.value
    
    for (let step = 0; step < numSteps; step++)
    {
        velocityVariable.material.uniforms['positionTexture'].value = computeRenderer.getCurrentRenderTarget(positionVariable).texture
        velocityVariable.material.uniforms['velocityTexture'].value = computeRenderer.getCurrentRenderTarget(velocityVariable).texture
        computeRenderer.doRenderTarget(velocityVariable.material, computeRenderer.getAlternateRenderTarget(velocityVariable))

        positionVariable.material.uniforms['positionTexture'].value = computeRenderer.getCurrentRenderTarget(positionVariable).texture
        positionVariable.material.uniforms['velocityTexture'].value = computeRenderer.getAlternateRenderTarget(velocityVariable).texture
        computeRenderer.doRenderTarget(positionVariable.material, computeRenderer.getAlternateRenderTarget(positionVariable))

        computeRenderer.currentTextureIndex = computeRenderer.currentTextureIndex === 0 ? 1 : 0
    }

    const currentPosition = new Float32Array(4 * numVertices);
    renderer.readRenderTargetPixels(computeRenderer.getCurrentRenderTarget(positionVariable), 0, 0, 1, numVertices, currentPosition)
    positionAttributes.set(currentPosition)
    geometry.computeVertexNormals()
    geometry.attributes.position.needsUpdate = true
}


/**
 * GUI
 */
const rightButton = document.querySelector('button.right')
const leftButton  = document.querySelector('button.left')
const upButton    = document.querySelector('button.up')
const downButton  = document.querySelector('button.down')
const ccwButton   = document.querySelector('button.ccw')
const acwButton   = document.querySelector('button.acw')

const slider = document.querySelector('.k')

rightButton.addEventListener('mousedown', () =>
{
    velocityVariable.material.uniforms['forceMode'].value = 1
})

leftButton.addEventListener('mousedown', () =>
{
    velocityVariable.material.uniforms['forceMode'].value = 2
})

upButton.addEventListener('mousedown', () =>
{
    velocityVariable.material.uniforms['forceMode'].value = 3
})

downButton.addEventListener('mousedown', () =>
{
    velocityVariable.material.uniforms['forceMode'].value = 4
})


ccwButton.addEventListener('mousedown', () =>
{
    velocityVariable.material.uniforms['forceMode'].value = 5
})

acwButton.addEventListener('mousedown', () =>
{
    velocityVariable.material.uniforms['forceMode'].value = 6
})

document.addEventListener('mouseup', () => 
{
    velocityVariable.material.uniforms['forceMode'].value = 0
})

/**
 * Animate
 */
const clock = new THREE.Clock()

const tick = () =>
{
    const elapsedTime = clock.getElapsedTime()

    // Update controls
    controls.update()

    // Simulate
    if (meshData != null) simulate()

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()