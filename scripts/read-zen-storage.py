"""Read the add-on's storage.local from the Zen profile, without opening Zen.

Prints the smart autoplay log (ytfAutoplayLog) and the block lists. Zen keeps storage.local in IndexedDB:
snappy-compressed structured-clone values, keys shifted by one character. Needs: pip install cramjam.

  python scripts/read-zen-storage.py
"""
import glob, json, os, shutil, sqlite3, struct, sys, tempfile

import cramjam

UUID_PREF = "yt-filter@loftspace"


def parse(b):
    pos=[0]
    def pair():
        lo,hi=struct.unpack_from('<II',b,pos[0]); pos[0]+=8; return hi,lo
    def read():
        start=pos[0]; hi,lo=pair()
        if hi<0xFFF00000: return struct.unpack_from('<d',b,start)[0]
        t=hi-0xFFFF0000
        if hi==0xFFF10000: return read()
        if t==0: return None
        if t==1: return 'undefined'
        if t==2: return bool(lo)
        if t==3: return struct.unpack('<i',struct.pack('<I',lo))[0]
        if t==4:
            n=lo&0x7fffffff; latin=lo&0x80000000
            if latin: s=b[pos[0]:pos[0]+n].decode('latin1'); size=n
            else: s=b[pos[0]:pos[0]+2*n].decode('utf-16le'); size=2*n
            pos[0]+=(size+7)//8*8; return s
        if t==7:
            out=[]
            while True:
                k=read()
                if k=='__END__': return out
                out.append(read())
        if t==8:
            out={}
            while True:
                k=read()
                if k=='__END__': return out
                out[k]=read()
        if t==0x13: return '__END__'
        return f'<tag {t:x}>'
    return read()

def shifted(key):
    return "0" + "".join(chr(ord(ch) + 1) for ch in key)


def main():
    profiles = glob.glob(os.path.expandvars(r"%APPDATA%\zen\Profiles\*"))
    for prof in profiles:
        prefs = os.path.join(prof, "prefs.js")
        if not os.path.exists(prefs):
            continue
        text = open(prefs, encoding="utf-8", errors="replace").read()
        at = text.find(UUID_PREF + '\\":\\"')
        if at < 0:
            continue
        uuid = text[at + len(UUID_PREF) + 5 : at + len(UUID_PREF) + 41]
        idb = glob.glob(os.path.join(prof, "storage", "default", f"moz-extension+++{uuid}^*", "idb", "*.sqlite"))
        if not idb:
            continue
        tmp = tempfile.mkdtemp()
        for f in glob.glob(idb[0] + "*"):  # copy with -wal/-shm, Zen may hold the file open
            shutil.copy(f, tmp)
        db = sqlite3.connect(os.path.join(tmp, os.path.basename(idb[0])))
        wanted = {shifted(k): k for k in sys.argv[1:] or ["ytfAutoplayLog", "blockChannels", "blockWords"]}
        for key, data in db.execute("select key, data from object_data"):
            name = wanted.get(bytes(key).decode("latin1"))
            if name:
                value = parse(bytes(cramjam.snappy.decompress_raw(bytes(data))))
                print(name, "=", json.dumps(value, ensure_ascii=False, indent=1))
        db.close()
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
