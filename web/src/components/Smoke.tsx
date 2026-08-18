import { motion } from "motion/react";

export default function Smoke() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      smoke
    </motion.div>
  );
}
