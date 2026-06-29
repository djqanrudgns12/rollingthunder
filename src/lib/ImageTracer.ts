export class ImageTracer {
  /**
   * Extract polygon vertices from an image's alpha channel.
   * Uses a basic Marching Squares / contour tracing and Douglas-Peucker simplification.
   */
  static async traceImage(file: File, simplifyTolerance: number = 5): Promise<{x: number, y: number}[]> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        
        // Use a max size for performance
        const maxDim = 300;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('No canvas context');

        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        // Simple Contour Tracing (Moore Neighborhood) or finding first contour
        const points = this.traceContour(data, w, h);
        if (points.length === 0) {
          return resolve([
            {x: -50, y: -50}, {x: 50, y: -50}, {x: 50, y: 50}, {x: -50, y: 50}
          ]); // fallback
        }

        // Center the points around 0,0
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        points.forEach(p => {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        });

        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;

        const centered = points.map(p => ({
          x: p.x - cx,
          y: p.y - cy
        }));

        const simplified = this.simplify(centered, simplifyTolerance);
        
        resolve(simplified);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  private static traceContour(data: Uint8ClampedArray, width: number, height: number): {x: number, y: number}[] {
    const isSolid = (x: number, y: number) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return false;
      const alpha = data[(y * width + x) * 4 + 3];
      return alpha > 128;
    };

    // Find start point
    let startX = -1, startY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (isSolid(x, y)) {
          startX = x;
          startY = y;
          break;
        }
      }
      if (startX !== -1) break;
    }

    if (startX === -1) return [];

    const points: {x: number, y: number}[] = [];
    const dirX = [1, 1, 0, -1, -1, -1, 0, 1];
    const dirY = [0, 1, 1, 1, 0, -1, -1, -1];
    
    let curX = startX;
    let curY = startY;
    let dir = 7;

    do {
      points.push({x: curX, y: curY});
      let found = false;
      for (let i = 0; i < 8; i++) {
        // start checking from the left of current direction
        const checkDir = (dir + 5 + i) % 8;
        const nx = curX + dirX[checkDir];
        const ny = curY + dirY[checkDir];
        if (isSolid(nx, ny)) {
          curX = nx;
          curY = ny;
          dir = checkDir;
          found = true;
          break;
        }
      }
      if (!found) break; // Isolated pixel
    } while (curX !== startX || curY !== startY);

    return points;
  }

  // Douglas-Peucker simplification
  private static simplify(points: {x: number, y: number}[], tolerance: number): {x: number, y: number}[] {
    if (points.length <= 3) return points;
    
    let maxDist = 0;
    let maxIdx = 0;
    
    const p1 = points[0];
    const p2 = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
      const dist = this.pointLineDist(points[i], p1, p2);
      if (dist > maxDist) {
        maxDist = dist;
        maxIdx = i;
      }
    }

    if (maxDist > tolerance) {
      const left = this.simplify(points.slice(0, maxIdx + 1), tolerance);
      const right = this.simplify(points.slice(maxIdx), tolerance);
      return left.slice(0, left.length - 1).concat(right);
    } else {
      return [p1, p2];
    }
  }

  private static pointLineDist(p: {x: number, y: number}, p1: {x: number, y: number}, p2: {x: number, y: number}) {
    const num = Math.abs((p2.y - p1.y)*p.x - (p2.x - p1.x)*p.y + p2.x*p1.y - p2.y*p1.x);
    const den = Math.sqrt(Math.pow(p2.y - p1.y, 2) + Math.pow(p2.x - p1.x, 2));
    if (den === 0) return Math.sqrt(Math.pow(p.x - p1.x, 2) + Math.pow(p.y - p1.y, 2));
    return num / den;
  }
}
