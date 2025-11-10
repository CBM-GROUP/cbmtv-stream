import Image from 'next/image';

const Preloader = () => {
  return (
    <div className="preloader">
      <div className="preloader-inner">
        <Image
          src="/images/CBM TV Yellow Logo.png"
          alt="CBM TV Logo"
          width={200}
          height={200}
        />
      </div>
    </div>
  );
};

export default Preloader;
