"use client";
import Image from "next/image";

const programs = [
  { name: "Program One", src: "/programs/program1.png" },
  { name: "Program Two", src: "/programs/program2.png" },
  { name: "Program Three", src: "/programs/program3.png" },
  { name: "Program Four", src: "/programs/program4.png" },
  { name: "Program Five", src: "/programs/program5.png" },
  { name: "Program Six", src: "/programs/program6.png" },
  // Add more as needed
];

export default function ProgramsGrid() {
  return (
    <div className="program-grid">
      {programs.map((program, index) => (
        <div key={index} className="program-item">
          <Image
            src={program.src}
            alt={program.name}
            width={300}
            height={180}
            className="program-image"
          />
          <div className="program-text">{program.name}</div>
        </div>
      ))}
    </div>
  );
}
