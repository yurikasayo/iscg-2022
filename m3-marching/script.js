/**
 * GUI
 */
const GUI = lil.GUI
const gui = new GUI()
const debugObject = {}

/**
 * Base
 */
// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

// loading
const loading = document.querySelector('.loading')

/**
 * Material
 */
const material = new THREE.MeshStandardMaterial( { color: 0xffffff, side: 2 } )
const lineMaterial = new THREE.MeshBasicMaterial( { color: 0x333333, wireframe: true })

/**
 * Marching Tetrahedra
 */
const distanceFunction = (v) =>
{
    const x = Math.cos(v.y) * v.x - Math.sin(v.y) * v.z
    const z = Math.sin(v.y) * v.x + Math.cos(v.y) * v.z
    
    const d1 = Math.max(Math.abs(x), Math.abs(v.y/2), Math.abs(z)) - 2.0
    const d2 = Math.max(v.x * v.x + v.z * v.z - 4.0 * 4.0, Math.abs(v.y - 3.5) - 1.0)
    const d3 = Math.max(v.x * v.x + v.z * v.z - 2.0 * 2.0, Math.abs(v.y) - 4.0)

    const dist = Math.min(0.8 * d1 + 0.2 * d3, d2)

    return dist
}

const idToVector = (x, y, z, id, gridSize) => {
    const v = new THREE.Vector3(
        x + (Math.floor(id / 2) % 2) * gridSize,
        y + (Math.floor((id+1) / 2) % 2) * gridSize,
        z + (Math.floor(id / 4) % 2) * gridSize
    )
    return v
} 

const interpolate = (isoValue, p1, p2, f1, f2) =>
{
    if (Math.abs(isoValue-f1) < 1e-5) return p1
    if (Math.abs(isoValue-f2) < 1e-5) return p2
    if (Math.abs(f1-f2) < 1e-5) return p1
    
    const mu = (isoValue - f1) / (f2 - f1)
    const p = new THREE.Vector3()
    p.lerpVectors(p1, p2, mu)
    
    return p
}

const marchingTetrahedra = (gridRes, gridSize, isoValue) =>
{
    const tetraPositions = [
        [0, 2, 3, 7],
        [0, 2, 6, 7],
        [0, 4, 6, 7],
        [0, 6, 1, 2],
        [0, 6, 1, 4],
        [5, 6, 1, 4]
    ]

    vertices = []
    faceNum = 0
    faceids = []

    for (let x = -gridRes / 2; x < gridRes / 2; x+=gridSize) 
    {
        for (let y = -gridRes / 2; y < gridRes / 2; y+=gridSize) 
        {
            for (let z = -gridRes / 2; z < gridRes / 2; z+=gridSize) 
            {
                for (let i = 0; i < tetraPositions.length; i++)
                {
                    const v0 = idToVector(x, y, z, tetraPositions[i][0], gridSize)
                    const v1 = idToVector(x, y, z, tetraPositions[i][1], gridSize)
                    const v2 = idToVector(x, y, z, tetraPositions[i][2], gridSize)
                    const v3 = idToVector(x, y, z, tetraPositions[i][3], gridSize)

                    const f0 = distanceFunction(v0)
                    const f1 = distanceFunction(v1)
                    const f2 = distanceFunction(v2)
                    const f3 = distanceFunction(v3)

                    let triIndex = 0
                    if (f0 < isoValue) triIndex += 1
                    if (f1 < isoValue) triIndex += 2
                    if (f2 < isoValue) triIndex += 4
                    if (f3 < isoValue) triIndex += 8
                    
                    switch(triIndex)
                    {
                        case 0:
                        case 15:
                            break

                        case 1:
                        case 14:
                            faceNum++
                            faceids.push(vertices.length, vertices.length + 1, vertices.length + 2)
                            vertices.push(interpolate(isoValue, v0, v1, f0, f1))
                            vertices.push(interpolate(isoValue, v0, v2, f0, f2))
                            vertices.push(interpolate(isoValue, v0, v3, f0, f3))
                            break

                        case 2:
                        case 13:
                            faceNum++
                            faceids.push(vertices.length, vertices.length + 1, vertices.length + 2)
                            vertices.push(interpolate(isoValue, v1, v0, f1, f0))
                            vertices.push(interpolate(isoValue, v1, v3, f1, f3))
                            vertices.push(interpolate(isoValue, v1, v2, f1, f2))
                            break

                        case 3:
                        case 12:
                            faceNum+=2
                            faceids.push(vertices.length, vertices.length + 1, vertices.length + 2, vertices.length + 1, vertices.length + 3, vertices.length + 2)
                            vertices.push(interpolate(isoValue, v0, v3, f0, f3))
                            vertices.push(interpolate(isoValue, v0, v2, f0, f2))
                            vertices.push(interpolate(isoValue, v1, v3, f1, f3))
                            vertices.push(interpolate(isoValue, v1, v2, f1, f2))
                            break
                            
                        case 4:
                        case 11:
                            faceNum++
                            faceids.push(vertices.length, vertices.length + 1, vertices.length + 2)
                            vertices.push(interpolate(isoValue, v2, v0, f2, f0))
                            vertices.push(interpolate(isoValue, v2, v1, f2, f1))
                            vertices.push(interpolate(isoValue, v2, v3, f2, f3))
                            break

                        case 5:
                        case 10:
                            faceNum+=2
                            faceids.push(vertices.length, vertices.length + 1, vertices.length + 2, vertices.length, vertices.length + 3, vertices.length + 1)
                            vertices.push(interpolate(isoValue, v0, v1, f0, f1))
                            vertices.push(interpolate(isoValue, v2, v3, f2, f3))
                            vertices.push(interpolate(isoValue, v0, v3, f0, f3))
                            vertices.push(interpolate(isoValue, v1, v2, f1, f2))
                            break

                        case 6:
                        case 9:
                            faceNum+=2
                            faceids.push(vertices.length, vertices.length + 1, vertices.length + 2, vertices.length + 2, vertices.length + 3, vertices.length)
                            vertices.push(interpolate(isoValue, v0, v1, f0, f1))
                            vertices.push(interpolate(isoValue, v1, v3, f1, f3))
                            vertices.push(interpolate(isoValue, v2, v3, f2, f3))
                            vertices.push(interpolate(isoValue, v0, v2, f0, f2))
                            break

                        case 7:
                        case 8:
                            faceNum++
                            faceids.push(vertices.length, vertices.length + 1, vertices.length + 2)
                            vertices.push(interpolate(isoValue, v3, v0, f3, f0))
                            vertices.push(interpolate(isoValue, v3, v2, f3, f2))
                            vertices.push(interpolate(isoValue, v3, v1, f3, f1))
                            break
                    }
                }
            }
        }
    }

    const geometry = new THREE.BufferGeometry()
    const positionAttributes = new Float32Array(vertices.length * 3)
    for (let i = 0; i < vertices.length; i++)
    {
        positionAttributes[i * 3 + 0] = vertices[i].x
        positionAttributes[i * 3 + 1] = vertices[i].y
        positionAttributes[i * 3 + 2] = vertices[i].z
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positionAttributes, 3))
    geometry.setIndex(faceids)

    return geometry
}

const geometry = marchingTetrahedra(10, 0.05, 0.00001)
geometry.computeVertexNormals()
const mesh = new THREE.Mesh(geometry, material)
scene.add(mesh)


/**
 * Lights
 */
 const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
 scene.add(ambientLight)
 
 const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7)
 directionalLight.castShadow = true
 directionalLight.shadow.mapSize.set(1024, 1024)
 directionalLight.shadow.camera.far = 15
 directionalLight.shadow.camera.left = - 7
 directionalLight.shadow.camera.top = 7
 directionalLight.shadow.camera.right = 7
 directionalLight.shadow.camera.bottom = - 7
 directionalLight.position.set(5, 5, 5)
 scene.add(directionalLight)


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
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
camera.position.set(10, 10, 10)
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
renderer.setClearColor(0xeeeeee)


/**
 * Animate
 */
const clock = new THREE.Clock()

const tick = () =>
{
    const elapsedTime = clock.getElapsedTime()

    // Update controls
    controls.update()

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()