import CountUp from '../react-bits/CountUp';

interface AnimatedNumberProps {
  value: number;
  suffix?: string;
  className?: string;
}

/** Número que gira suavemente até o novo valor quando um ajuste é alterado. */
export function AnimatedNumber({ value, suffix = '', className }: AnimatedNumberProps) {
  return (
    <CountUp
      to={value}
      suffix={suffix}
      duration={0.3}
      trigger="load"
      mode="roll"
      className={className}
    />
  );
}
