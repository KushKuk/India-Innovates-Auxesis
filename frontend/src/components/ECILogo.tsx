import { cn } from "@/lib/utils";

interface ECILogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  size?: number;
  className?: string;
}

/**
 * Reusable ECI Logo component.
 * Use a true SVG to ensure transparency and sharpness at any size.
 */
export function ECILogo({ size = 80, className, ...props }: ECILogoProps) {
  return (
    <img
      // Ensure you have downloaded the true SVG and placed it in your /public folder
      src="/Election_Commission_of_India_Logo.svg.png" 
      alt="Election Commission of India Logo"
      width={size}
      height={size}
      className={cn("object-contain", className)}
      {...props}
    />
  );
}