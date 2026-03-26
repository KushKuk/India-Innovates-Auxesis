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
      src="/OneVote.png" 
      alt="OneVote Logo"
      width={size}
      height={size}
      className={cn("object-contain", className)}
      {...props}
    />
  );
}