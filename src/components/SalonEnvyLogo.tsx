interface LogoProps {
  width?: number
  className?: string
}

export function SalonEnvyLogo({ width = 160, className = "" }: LogoProps) {
  return (
    <svg
      width={width}
      height={width * 0.45}
      viewBox="0 0 200 90"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <text
        x="4"
        y="36"
        fontFamily="'Inter', 'Arial Black', sans-serif"
        fontSize="34"
        fontWeight="900"
        fill="#FFFFFF"
        letterSpacing="6"
      >
        SALON
      </text>
      <text
        x="4"
        y="78"
        fontFamily="'Georgia', 'Times New Roman', serif"
        fontSize="44"
        fontWeight="400"
        fontStyle="italic"
        fill="#CDC9C0"
        letterSpacing="1"
      >
        Envy
      </text>
      <text
        x="154"
        y="50"
        fontFamily="'Inter', sans-serif"
        fontSize="16"
        fontWeight="700"
        fill="#FFFFFF"
      >
        ®
      </text>
    </svg>
  )
}
