#!/usr/bin/awk -f
{
	total = $2;
	free = $3;
	used = $4;
	percent = $5;
}
END {
	print total, free, used, percent;
}
