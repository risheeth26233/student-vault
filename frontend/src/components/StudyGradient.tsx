import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react';

function CanvasResolution() {
  const width = useThree(state => state.size.width);
  const setDpr = useThree(state => state.setDpr);
  useEffect(() => { setDpr(width < 420 ? 1 : 1.25); }, [width, setDpr]);
  return null;
}

export default function StudyGradient() {
  return <ShaderGradientCanvas pixelDensity={1.25} fov={45} lazyLoad={false}
    pointerEvents="none" powerPreference="low-power">
    <CanvasResolution />
    <ShaderGradient control="props" type="plane" animate="on"
      color1="#86c8b6" color2="#ffe0bf" color3="#2f857d"
      uSpeed={0.12} uStrength={2} uDensity={1.3} uFrequency={4.5}
      cDistance={3.6} cPolarAngle={90} lightType="3d" brightness={1.1}
      grain="off" reflection={0} />
  </ShaderGradientCanvas>;
}
